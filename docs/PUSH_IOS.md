# iOS 푸시 (APNs) — 준비물과 배선

## Firebase 는 필요 없다

Android 를 안 내기로 했으므로 **FCM(Firebase)은 쓸 이유가 없다.**
FCM 은 안드로이드 푸시 채널이고, iOS 로 보낼 때도 결국 **APNs 를 대신 호출해 주는 중계**일 뿐이다.
iOS 만 낼 거면 중계를 한 겹 끼우는 대신 **APNs 를 직접 부르는 게 단순하고 빠르다**
(의존성·계정·SDK가 하나씩 줄어든다).

## Apple Developer 에서 받아올 것 — 세 가지

1. **Team ID**
   Apple Developer → Membership details → Team ID (`ABCDE12345` 꼴, 10자)
   → Universal Links(`apple-app-site-association`)에도 이 값이 들어간다.

2. **APNs Auth Key (.p8 파일)**
   Certificates, Identifiers & Profiles → **Keys** → ⊕ → 이름 아무거나 →
   **Apple Push Notification service (APNs)** 체크 → Continue → Register → **Download**
   - ⚠️ **딱 한 번만 받을 수 있다.** 다시 못 받으니 안전한 곳에 보관할 것.
   - 파일 이름이 `AuthKey_XXXXXXXXXX.p8` 인데, 그 `XXXXXXXXXX` 가 **Key ID** 다.
   - 이 키 하나로 **개발·운영 모두** 되고, 이 팀의 모든 앱에 쓸 수 있다.

3. **Bundle ID** — 이미 정해져 있다: `app.moabook`

## 나한테 줄 것

| 항목 | 예시 | 어디에 쓰나 |
|---|---|---|
| Team ID | `ABCDE12345` | Universal Links + APNs 토큰 서명 |
| Key ID | `A1B2C3D4E5` | APNs 토큰 서명 |
| `.p8` 파일 내용 | `-----BEGIN PRIVATE KEY-----...` | APNs 토큰 서명 |

⚠️ **`.p8` 는 비밀키다. 채팅에 붙여넣지 말고 Supabase 대시보드에 직접 넣어 줘.**
Supabase → Project Settings → Edge Functions → Secrets 에 이렇게:

```
APNS_TEAM_ID   = ABCDE12345
APNS_KEY_ID    = A1B2C3D4E5
APNS_BUNDLE_ID = app.moabook
APNS_PRIVATE_KEY = (.p8 파일을 텍스트 편집기로 열어 통째로 붙여넣기, 줄바꿈 포함)
```

Team ID 만 알려주면 된다 — 그건 비밀이 아니고 `apple-app-site-association` 에 넣어야 한다.

## 그다음은 내가 한다

- `push_subscriptions` 에 채널 구분(`web` | `ios`) 추가
- `send-push` 가 채널에 따라 갈라 보내게 (웹은 지금 그대로 VAPID, iOS 는 APNs)
- `@capacitor/push-notifications` 로 기기 토큰 등록
- 알림 설정 화면이 네이티브에서는 APNs 권한을 묻게

⚠️ **웹 푸시를 깨뜨리지 않는다.** 지금 실사용자는 전부 웹(PWA)에 있다.

## 시뮬레이터로는 어디까지 되나

- 권한 팝업·토큰 발급 흐름: 확인 가능
- **실제 알림 수신: 안 된다.** 실기기 + 개발자 계정 서명이 필요하다.


---

# 배선 현황 (2026-08-19)

## 코드는 다 됐다 ✅

| | |
|---|---|
| `supabase/migrations/20260823000001_push_channel.sql` | `push_subscriptions.channel` (`web` \| `ios`) |
| `supabase/functions/send-push/apns.ts` | APNs 발송 (.p8 토큰 인증, JWT 50분 캐시) |
| `supabase/functions/send-push/index.ts` | 채널별로 갈라 보냄 · 죽은 토큰 정리 |
| `src/lib/nativePush.ts` | 권한 요청 · 기기 토큰 등록/해제 · 알림 탭 이동 |
| `src/hooks/usePushNotifications.ts` | 앱이면 APNs 길로 분기 (웹은 그대로) |
| `ios/App/App/App.entitlements` | `aps-environment` (프로젝트에 연결 완료, 빌드 확인) |

## 켜는 순서 — 이 순서를 지켜야 한다

1. **마이그레이션 실행** (`20260823000001_push_channel.sql`)
2. **Supabase Secrets 에 APNs 값 4개** 입력 (위 참고)
3. `supabase functions deploy send-push`

> 2·3번을 먼저 해도 웹 푸시는 안 깨진다 — 함수가 칼럼을 하나씩 고르지 않고 `*` 로 받아
> `channel` 이 없으면 'web' 으로 보게 해뒀다. 그래도 순서대로 하는 게 낫다.

## 아직 확인 못 한 것

- **실제 알림 수신** — 시뮬레이터는 APNs 토큰을 받지 못한다. **실기기 + 서명**이 필요하다.
  (앱 실행 시 `PushNotifications addListener` 가 불리는 것까지는 시뮬레이터에서 확인했다)
- `aps-environment` 는 지금 `development` 다. TestFlight·스토어로 아카이브하면
  Xcode 가 `production` 으로 바꿔 서명한다. 그때 **APNs 호스트도 운영으로 가야 한다**
  → Secrets 에서 `APNS_SANDBOX` 를 지우면 된다(없으면 운영). 개발 빌드로 시험할 땐 `true`.
