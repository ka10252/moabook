# 네이티브 앱 체크리스트

마지막 갱신: 2026-08-19 · **Android 출시 안 함 → iOS만 다룬다**

> Android 폴더(`android/`)는 지우지 않고 남겨뒀다. 다시 하게 될 때 서명·권한 설정을
> 되살리는 것보다 두는 편이 싸다. 대신 이 문서에서는 Android 항목을 뺐다.

---

## 0. 웹 → 앱 반영은 어떻게 되나

네이티브는 **같은 웹 번들을 담은 껍데기**다. 기능을 따로 옮겨 심을 게 없다.

```bash
npm run native:sync     # 웹 빌드 → ios/ · android/ 로 복사
npm run native:ios      # 위 + Xcode 열기
```

⚠️ `native:sync` 는 **빌드된 dist 를 복사**한다. 코드만 고치고 sync 하면 옛 화면이 그대로 들어간다.
`npm run native:sync` 스크립트에 빌드가 포함돼 있는지 확인하고 쓸 것.

---

## 1. 지금 확인된 것 ✅

시뮬레이터 iPhone 17 (iOS 26), Debug 빌드.

- [x] **빌드** — `** BUILD SUCCEEDED **` (CocoaPods 불필요, SPM)
- [x] **실행·로그인 유지** — 앱을 다시 켜도 세션이 살아 있다
- [x] **최신 웹 기능이 앱에 반영됨** — 서가에 칸 제목 없음, 책갈피 구분선,
      새 책등 글자(14px·볼드 해제)로 제목이 끝까지 보임
- [x] **에셋 번들 포함** — `ios/App/App/public/onboarding/*.webp`,
      `android/app/src/main/assets/public/onboarding/*.webp`
- [x] **안전영역** — 상단 노치·하단 홈 인디케이터에 버튼이 안 걸림
- [x] **딥링크** — `moabook://?onboarding=1` 로 온보딩이 뜬다
      (이 확인 과정에서 아래 2번 버그를 잡았다)

## 2. 이번에 고친 네이티브 전용 버그 🐛

**쿼리만 있는 딥링크가 앱에서 무시됐다.**

웹은 링크를 누르면 페이지가 새로 뜨니 마운트 때 `window.location.search` 를 한 번 읽으면 됐다.
앱은 새 페이지가 아니라 **이미 떠 있는 화면 안에서** 경로만 바뀐다 → 그 효과가 다시 돌지 않는다.

가장 아픈 건 **초대 링크**다. 경로 없이 쿼리만 있다(`https://…/?invite=TOK`).
앱을 켜둔 채로 초대 링크를 누르면 조용히 아무 일도 없었다.

→ 라우터의 `searchParams` 를 읽고 deps 에 넣도록 고쳤다 (`src/pages/Index.tsx`).

**같은 함정이 또 생길 자리**: 새 기능이 `window.location` / `document.referrer` 같은
"페이지가 새로 뜬다"를 전제한 값을 읽는다면, 앱에서는 한 번밖에 안 읽힌다.
라우터가 주는 값을 쓰고 deps 에 넣을 것.

## 3. 눈으로 봐야 하는 것 👀

시뮬레이터를 코드로 탭할 방법이 없다(`simctl` 에 탭 명령이 없고, AppleScript 는 손쉬운 사용 권한이 필요).
아래는 **직접 눌러서** 확인해야 한다. 시뮬레이터가 떠 있으면 1분이면 된다.

```bash
xcrun simctl openurl 2BA53F69-CBFB-4BAC-8B52-E6D784D31CC4 "moabook://?onboarding=1"
```

- [ ] **온보딩 '보는 방식'** — 화면 사진 3장(책등·책표지·지도)이 다 보이는지.
      WebP 라 안 보이면 이 형식 문제다 → PNG 로 바꾸면 된다.
- [ ] **온보딩 '다음' 버튼** — 사진이 들어간 단계에서도 항상 보이는지
      (내용만 스크롤하게 고쳤지만, 실기 폰트 크기가 다르면 또 밀릴 수 있다)
- [ ] **지도 뷰** — 타일이 뜨는지. 유일하게 외부 네트워크에 기대는 화면이다
      (`basemaps.cartocdn.com`). 앱은 `capacitor://` 라 CORS·ATS 가 웹과 다르게 걸릴 수 있다.
- [ ] **알림 팝업 스크롤** — 손가락으로 밀어서 스크롤되는지 (마우스 휠과 다르다)
- [ ] **장르 드롭다운** — 열고 닫히는지, 터치 타깃이 충분한지

---

## 4. 남은 큰 작업

### 4.1 🔴 푸시 재작업 — 앱 출시 전 필수

지금은 **Web Push(VAPID) + 서비스워커**다. 네이티브는 **APNs(iOS) / FCM(Android)** 로 채널이 다르다.
지금 상태로 앱을 내면 **앱 사용자는 알림을 하나도 못 받는다.**

- [ ] `push_subscriptions` 에 토큰 종류(`web` | `apns` | `fcm`) 칸 추가
- [ ] `send-push` 엣지 함수가 종류에 따라 갈라 보내게
- [ ] `@capacitor/push-notifications` 붙이고 토큰 등록 흐름
- [ ] Apple Developer 에서 APNs 인증키, Firebase 프로젝트 생성

⚠️ **웹 푸시를 깨뜨리지 않아야 한다.** 지금 실사용자는 전부 웹(PWA)에 있다.

### 4.2 🔴 Apple 심사 4.2 (Minimum Functionality)

웹을 감싸기만 한 앱은 **반려된다.** 네이티브 기능이 최소 하나 필요하다.

**권장: 카메라로 표지 촬영.** 책을 올릴 때 실물이 손에 있으니 가장 자연스럽고,
백로그 F23(표지 사진으로 등록 시작)과 같은 기능이라 **두 문제가 한 번에 풀린다.**
공유 시트를 곁들이면 더 안전하다.

- [ ] `@capacitor/camera` 로 등록 화면의 사진 올리기를 촬영으로
- [ ] `@capacitor/share` 로 책 상세에 공유 버튼

### 4.3 🟡 Android 확인

- [ ] Android Studio 로 빌드 (아직 한 번도 안 돌렸다)
- [ ] 하드웨어 뒤로가기 — 오버레이가 떠 있을 때 앱이 종료되지 않는지
- [ ] 딥링크(App Links) — iOS 만 확인했다

### 4.4 🟡 Phaser(가상공간) 웹뷰 성능

- [ ] 프레임이 떨어지지 않는지 · 핀치와 스크롤이 충돌하지 않는지
- [ ] 백그라운드에서 메모리로 죽지 않는지
- 너무 느리면 **앱에서는 진입을 감추는 것도 선택지**다 (인터뷰상 사용 동기가 낮았다)

### 4.5 🟢 스토어 제출 준비물

`docs/STORE_RELEASE_CHECKLIST.md` 참고. 아이콘·스플래시, 스크린샷, 개인정보 처리방침 URL(있음),
데이터 수집 신고(App Privacy), 연령 등급, 심사용 테스트 계정.

---

## 5. 배포 전 반드시 되돌릴 것 ⚠️

- [ ] `capacitor.config.ts` 의 `ios.webContentsDebuggingEnabled: true` → **false**
      켜둔 채 내보내면 배포본의 웹뷰를 누구나 들여다볼 수 있다.

---

## 6. 알아두면 시간 아끼는 것들

- **헤드리스 시뮬레이터에서는 딥링크가 안 온다.** `simctl boot` 만 하면 UI 없는 상태라
  iOS 가 `scene(_:openURLContexts:)` 를 호출하지 않는다. `simctl openurl` 은 성공을 반환하는데
  앱은 아무것도 못 받는다 — 조용히 실패한다. **`open -a Simulator` 를 먼저 할 것.**
- **웹뷰 로그** 는 `xcrun simctl launch --console-pty <UDID> app.moabook` 에 `⚡️ [log] -` 로 나온다.
- 시작 로그의 `JS Eval error A JavaScript exception occurred` 는 페이지가 뜨기 전
  Capacitor 가 넣는 초기 스크립트에서 나는 것으로, 이전 빌드에서도 계속 있었다. 동작에는 영향 없다.
