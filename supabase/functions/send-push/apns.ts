/**
 * APNs(iOS 푸시) 발송.
 *
 * 왜 Firebase 를 안 쓰나: FCM 은 안드로이드 채널이고, iOS 로 보낼 때도 결국 APNs 를
 * 대신 불러주는 중계다. Android 를 안 내기로 했으므로 중계를 한 겹 끼울 이유가 없다.
 *
 * 인증은 **토큰 기반(.p8)** 이다. 인증서(.p12) 방식은 1년마다 갱신해야 하지만
 * 토큰은 만료가 없고 팀의 모든 앱에 쓸 수 있다.
 * JWT 는 Apple 규정상 **최대 1시간**만 유효하고, 너무 자주 새로 만들면 429 를 준다
 * → 50분 캐시한다.
 */
const TEAM_ID = Deno.env.get("APNS_TEAM_ID");
const KEY_ID = Deno.env.get("APNS_KEY_ID");
const BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") ?? "app.moabook";
const PRIVATE_KEY = Deno.env.get("APNS_PRIVATE_KEY");

/** 개발 빌드(Xcode 에서 직접 설치)는 sandbox 로, 스토어·TestFlight 는 운영으로 간다 */
const HOST = Deno.env.get("APNS_SANDBOX") === "true"
  ? "https://api.sandbox.push.apple.com"
  : "https://api.push.apple.com";

export const apnsConfigured = () => !!(TEAM_ID && KEY_ID && PRIVATE_KEY);

let cached: { jwt: string; at: number } | null = null;

async function authToken(): Promise<string> {
  const now = Date.now();
  if (cached && now - cached.at < 50 * 60 * 1000) return cached.jwt;

  const header = { alg: "ES256", kid: KEY_ID };
  const claims = { iss: TEAM_ID, iat: Math.floor(now / 1000) };
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsigned = `${b64(header)}.${b64(claims)}`;

  // .p8 은 PKCS#8 PEM 이다. 헤더·줄바꿈을 걷어내고 DER 로 되돌린다.
  const pem = PRIVATE_KEY!.replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned)),
  );
  const sigB64 = btoa(String.fromCharCode(...sig))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${unsigned}.${sigB64}`;
  cached = { jwt, at: now };
  return jwt;
}

export interface ApnsResult {
  token: string;
  ok: boolean;
  /** 이 토큰이 죽었는지 — 앱 삭제 등. 죽었으면 지워야 한다. */
  dead: boolean;
  reason?: string;
}

export async function sendApns(
  tokens: string[],
  msg: { title: string; body: string; url: string },
): Promise<ApnsResult[]> {
  if (!apnsConfigured()) {
    return tokens.map((t) => ({ token: t, ok: false, dead: false, reason: "apns_not_configured" }));
  }
  const jwt = await authToken();

  return await Promise.all(tokens.map(async (token) => {
    try {
      const res = await fetch(`${HOST}/3/device/${token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": BUNDLE_ID,
          "apns-push-type": "alert",
          // 5 = 즉시. 절전 모드에서도 바로 뜬다.
          "apns-priority": "10",
        },
        body: JSON.stringify({
          aps: { alert: { title: msg.title, body: msg.body }, sound: "default" },
          // 알림을 눌렀을 때 갈 곳. 앱이 이 값을 읽어 화면을 옮긴다.
          url: msg.url,
        }),
      });
      if (res.ok) return { token, ok: true, dead: false };

      const text = await res.text();
      const reason = (() => { try { return JSON.parse(text).reason as string; } catch { return text; } })();
      // 410(BadDeviceToken/Unregistered) = 앱이 지워졌거나 토큰이 무효 → 지운다.
      const dead = res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered";
      return { token, ok: false, dead, reason };
    } catch (err) {
      return { token, ok: false, dead: false, reason: String(err) };
    }
  }));
}
