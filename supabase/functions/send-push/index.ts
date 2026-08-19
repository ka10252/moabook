import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApns, apnsConfigured } from "./apns.ts";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@moabook.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * 이 함수를 부를 수 있는 건 우리 DB 트리거뿐이다.
 *
 * 예전 버전은 user_id·title·body를 받는 대로 그냥 보냈다. 로그인한 사람이라면 누구나
 * 아무 유저에게 "계정이 정지되었습니다"처럼 우리 이름을 사칭한 알림을 쏠 수 있었다.
 * 푸시는 잠금화면에 뜨는 만큼 신뢰도가 높아, 피싱에 그대로 쓰인다.
 * → 공유 비밀키를 아는 호출자만 통과시킨다.
 */
const TRIGGER_SECRET = Deno.env.get("PUSH_TRIGGER_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-push-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 비밀키가 아예 설정되지 않았다면 열어두지 않는다 — 조용히 뚫려 있는 것보다 안 되는 게 낫다.
  if (!TRIGGER_SECRET) {
    console.error("PUSH_TRIGGER_SECRET is not set — refusing to send.");
    return json({ error: "not configured" }, 500);
  }
  if (req.headers.get("x-push-secret") !== TRIGGER_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const { user_id, title, body, url } = await req.json();
  if (!user_id || !title) return json({ error: "user_id and title are required" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: subs } = await supabase
    .from("push_subscriptions")
    // ⚠️ 칼럼을 하나하나 적지 않는다. `channel` 은 마이그레이션으로 생기는데,
    //    함수가 먼저 배포되면 없는 칼럼을 골라 **웹 푸시까지 통째로 400** 이 된다.
    //    `*` 로 받아 없으면 'web' 으로 본다 — 배포 순서가 어긋나도 안전하다.
    .select("*")
    .eq("user_id", user_id);

  if (!subs?.length) return json({ sent: 0 });

  // 채널마다 보내는 길이 다르다. 섞어서 보내면 APNs 토큰을 web-push 로 밀어 넣게 되고,
  // 그건 조용히 실패한다(에러도 애매하게 난다).
  const webSubs = subs.filter((s) => (s.channel ?? "web") === "web");
  const iosSubs = subs.filter((s) => s.channel === "ios");

  const payload = JSON.stringify({ title, body: body ?? "", url: url ?? "/" });
  const dead: string[] = [];
  let sent = 0;

  // ── 웹 푸시 (VAPID) — 지금 실사용자는 대부분 여기 있다. 건드리지 않는다.
  if (webSubs.length) {
    // @ts-ignore — npm: specifier supported in Deno 1.28+
    const webpush = await import("npm:web-push");
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const results = await Promise.allSettled(
      webSubs.map(({ subscription }) => webpush.sendNotification(subscription, payload)),
    );
    // 만료된 구독(브라우저 데이터 삭제, 앱 삭제 등)은 계속 실패한다. 그때마다 재시도하면
    // 발송이 느려지고 로그가 더러워진다 — 404/410이면 죽은 구독이니 지운다.
    results.forEach((r, i) => {
      if (r.status === "fulfilled") sent++;
      else {
        const code = (r.reason as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) dead.push(webSubs[i].endpoint);
      }
    });
  }

  // ── iOS 앱 (APNs)
  if (iosSubs.length) {
    if (!apnsConfigured()) {
      // 키가 없으면 조용히 성공한 척하지 않는다 — "왜 앱에만 알림이 안 오지"로 헤매게 된다.
      console.error("APNs secrets missing — iOS 구독 %d건을 건너뜀", iosSubs.length);
    } else {
      const tokens = iosSubs.map((s) => s.endpoint);
      // 앱 아이콘 숫자는 '안 읽은 알림 수'다. 이 함수는 알림 행이 만들어진 뒤에 불리므로
      // 방금 것까지 포함된 값이 나온다.
      const { count: unread } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user_id)
        .eq("is_read", false);
      const res = await sendApns(tokens, {
        title, body: body ?? "", url: url ?? "/", badge: unread ?? undefined,
      });
      res.forEach((r) => {
        if (r.ok) sent++;
        else if (r.dead) dead.push(r.token);
        else console.error("APNs 실패", r.token.slice(0, 8), r.reason);
      });
    }
  }

  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return json({ sent, removed: dead.length, web: webSubs.length, ios: iosSubs.length });
});
