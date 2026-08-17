# 네이티브 앱 (F11) — iOS · Android

> 방식: **Capacitor 8**. 지금 웹앱(Vite + React + Phaser)을 그대로 네이티브 셸에 담는다.
> React Native는 전면 재작성이라 해당 없다.
> 시작: 2026-08-19

---

## 1. 지금까지 된 것

```
capacitor.config.ts          앱 id/이름/webDir + 스플래시·키보드 설정
src/lib/native.ts            isNative 판별 + 상태바·스플래시·안드로이드 뒤로가기
src/main.tsx                 네이티브에서만 초기화 호출
src/index.css                .safe-top / .safe-bottom (노치·홈 인디케이터)
android/  ios/               플랫폼 프로젝트 생성 완료 (cap add)
```

**npm 스크립트**
```bash
npm run native:sync      # 웹 빌드 → 네이티브로 복사
npm run native:ios       # 빌드 + 복사 + Xcode 열기
npm run native:android   # 빌드 + 복사 + Android Studio 열기
```

CocoaPods는 **필요 없다.** Capacitor 8은 Swift Package Manager를 쓴다.

### 손댄 이유가 있는 것들

- **서비스워커 리로드 로직을 네이티브에서 끈다** (`main.tsx`)
  앱은 번들을 파일로 들고 있어 "새 배포로 갈아타기"가 없고, 웹뷰의 서비스워커 지원이
  불안정해 `controllerchange`가 엉뚱하게 떠 **무한 새로고침**이 될 수 있다.
- **스플래시를 코드에서 내린다** (`launchAutoHide: false`)
  자동으로 내리면 React가 첫 화면을 그리기 전에 흰 화면이 한 번 보인다 — PWA에서 이미 겪었다.
- **키보드가 웹뷰를 밀지 않게 한다** (`resize: 'none'`)
  밀면 하단 탭바가 같이 올라와 게시판·채팅 입력 중에 탭바가 화면 중간에 뜬다.
- **안전영역은 한 규칙으로 웹·앱을 같이 덮는다**
  웹에서는 `env(safe-area-inset-*)`가 0이라 변화가 없다.
  ⚠️ 탭바는 `h-20` → `min-h-20`으로 바꿨다. 고정 높이에 padding만 더하면 안쪽이 눌린다.
- **안드로이드 하드웨어 뒤로가기를 히스토리와 연결했다** (`initAndroidBackButton`)
  우리 오버레이는 `useBackClose`가 history를 쌓아 닫는다. Capacitor의 `backButton`은
  history와 **별개로** 오므로, 그냥 두면 모달이 떠 있는데 앱이 종료된다.

---

## 2. 남은 것 — 큰 것부터

### 2.1 🔴 푸시 재작업 (가장 큼)

지금은 **Web Push(VAPID) + 서비스워커 + `send-push` 엣지 함수**다.
네이티브는 **APNs(iOS) / FCM(Android)** 토큰이라 채널이 다르다.

해야 할 것
- `push_subscriptions`에 **토큰 종류 구분** 추가 (`web` | `apns` | `fcm`)
- `send-push`가 종류에 따라 갈라 보내게 수정
- `@capacitor/push-notifications` 붙이고 토큰 등록 흐름 작성
- Firebase 프로젝트 + APNs 인증키(Apple Developer) 발급

⚠️ **웹 푸시를 깨뜨리지 않아야 한다.** 지금 실유저는 웹(PWA)에 있다.

### 2.2 🔴 Apple 심사 4.2 (Minimum Functionality)

웹을 감싸기만 한 앱은 **반려된다.** 네이티브 기능이 최소 하나 필요하다.

**후보 (결정 필요)**
| 후보 | 이 앱에 맞는가 | 비용 |
|---|---|---|
| **카메라로 표지 촬영** | 책을 올릴 때 실물이 손에 있다 — 가장 자연스럽다. 등록 화면 D안과 겹친다 | 중 |
| 네이티브 푸시 | 어차피 2.1에서 한다 | (포함) |
| 공유 시트 | "이 책 봐봐"를 카톡으로 보내는 흐름 | 소 |
| 생체인증 로그인 | 있으면 좋지만 이 앱의 정체성과는 무관 | 소 |

**권장: 카메라 + 공유 시트.** 카메라는 `docs/BACKLOG.md` F23의 D안(표지 사진으로 등록 시작)과
같은 기능이라 **두 문제가 한 번에 풀린다.**

### 2.3 🟡 인증 리다이렉트 → 딥링크

앱에서는 페이지가 `capacitor://`로 열린다. 그런데 **이메일 인증·비밀번호 재설정**은
메일 링크를 눌러 웹 주소로 돌아온다 → 앱으로 다시 들여보내야 한다.

- Universal Links(iOS) / App Links(Android) 설정
- Supabase Auth의 redirect URL에 앱 스킴 추가
- `@capacitor/app`의 `appUrlOpen` 리스너에서 토큰을 받아 세션 복원

⚠️ 이걸 안 하면 **앱에서 가입한 사람이 이메일 인증을 마칠 수 없다.** 치명적이다.

### 2.4 🟡 Phaser(가상공간) 웹뷰 확인

가상 커뮤니티룸이 Phaser 4 캔버스다. 웹뷰에서
- 프레임이 떨어지지 않는지
- 멀티터치(핀치)와 스크롤이 충돌하지 않는지
- 메모리 때문에 백그라운드에서 죽지 않는지

를 실기로 봐야 한다. 인터뷰상 가상룸 사용 동기는 낮으니, **너무 느리면 앱에서는
진입을 감추는 것도 선택지**다.

### 2.5 🟢 스토어 제출 준비물

`docs/STORE_RELEASE_CHECKLIST.md`에 이미 정리돼 있다. 요약하면
아이콘·스플래시 에셋, 스크린샷, 개인정보 처리방침 URL(있음), 데이터 수집 신고(App Privacy),
연령 등급, 테스트 계정.

---

## 3. 이 컴퓨터에 없어서 지금 못 하는 것

빌드·실기 확인은 아래를 설치해야 한다. **코드 작업은 설치 없이도 계속할 수 있다.**

| 필요 | 상태 | 무엇에 쓰나 |
|---|---|---|
| **Xcode** | ❌ 없음 (Command Line Tools만) | iOS 빌드·시뮬레이터·제출 |
| **Android Studio + SDK** | ❌ 없음 | Android 빌드·에뮬레이터 |
| Java 20 | ✅ 있음 | (Gradle은 17을 권장 — 문제 시 17로) |
| CocoaPods | 불필요 | Capacitor 8은 SPM |

설치 후
```bash
npm run native:android   # Android Studio 열림 → Run
npm run native:ios       # Xcode 열림 → 서명 팀 지정 후 Run
```

---

## 4. android/ · ios/ 를 커밋하는 이유

지우고 다시 만들 수 있지만, **서명 설정·권한 문구·아이콘·딥링크 설정이 이 폴더에 들어간다.**
`cap add`를 다시 하면 그게 전부 날아간다. 그래서 폴더는 커밋하고,
**빌드 산물과 웹 자산 복사본만** `.gitignore`에 넣었다(`android/app/src/main/assets/public/`,
`ios/App/App/public/` 등 — 이건 `cap sync`가 매번 다시 만든다).
