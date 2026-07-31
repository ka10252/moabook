# moabook 핵심 기능 명세 (회귀 방지 문서)

> **목적** — 기능을 추가하거나 버그를 고칠 때, **이미 잘 작동하던 기능이 깨지지 않도록** 하는 안전장치.
> 각 기능마다 ① 무엇을 하는가 ② 데이터 흐름(테이블·트리거·Edge Function·RLS) ③ 절대 깨지면 안 되는 불변식 ④ 변경 시 확인할 것 ⑤ 작동 상태 를 정리한다.
>
> **가장 큰 교훈 (2026-07-30 실제 사고):** 공용 테이블(`notifications`, `messages`)에 트리거를 붙이면 그 트리거 오류가 **부모 INSERT 전체를 롤백**시켜 핵심 거래가 마비될 수 있다. → 아래 [트리거 안전 규칙](#트리거-안전-규칙) 필독.

---

## 작동 상태 범례
| 표시 | 의미 |
|---|---|
| ✅ | 코드 경로 완전 + 빌드 통과 (+ 일부는 실사용 확인). 정상 작동. |
| ⚠️ | 작동하지만 주의할 이슈/한계 있음. |
| 🐛 | 배선은 됐으나 **실제로는 작동하지 않음**(확인된 버그). |
| 🧩 | 구현됐으나 앱에서 진입 불가(데드코드/프리뷰). |

### QA 방법 (이 문서 기준)
- **정적/구조 QA**: 코드 경로 추적 + `npm run build` 통과 + 마이그레이션/트리거/RLS 검토로 확인. (2026-07-31)
- **실사용 확인됨**: 대여 요청→수락, 텔레그램 수신(푸시 OFF 시), 벨 알림/푸시 수신 — 사용자가 직접 확인.
- **미검증(런타임 클릭 테스트 필요)**: 로그인 필요한 플로우의 인터랙티브 시나리오 전수. → 테스트 계정 주면 Playwright로 자동 QA 가능.

---

## 우선순위 개요
- **P0 (마비되면 서비스 정지)**: 회원가입/로그인, 책 등록, **대여/구매/나눔 요청→수락→반납**, 채팅, 알림 파이프라인.
- **P1 (핵심 경험)**: 서가/도서관, 책 상세·좋아요·위시·대기열, 커뮤니티(가입/게시판/책장), 푸시·텔레그램 알림, 프로필/차단/신고.
- **P2 (부가/차별화)**: 가상공간(멀티플레이어·캐릭터·이모트·읽는 책), 회원탈퇴, 관리자.

---

# P0 — 마비되면 서비스 정지

## 1. 회원가입 / 로그인 / 세션  ✅
- **무엇**: 이메일·비밀번호 가입(닉네임+거주국가 필수), 로그인, 로그아웃, 이메일 인증, 비밀번호 재설정.
- **데이터 흐름**:
  - `useAuth.tsx` → Supabase Auth. 가입 시 `options.data={nickname,country}` → 트리거 `handle_new_user`(SECURITY DEFINER)가 `profiles` 행 생성. (세션 없는 인증대기 상태라 RLS 우회 위해 트리거로 넣음)
  - 비밀번호 재설정은 `/auth/reset` 전용 페이지(세션이 홈으로 튕기지 않게 분리).
  - 로그인 후 딥링크 복귀: `AuthPromptModal`이 현재 URL을 `redirect` 파라미터로 넘기고 `AuthPage`가 로그인 후 그리로 복귀. **내부 경로만 허용**(`^\/(?!\/)`) — 오픈 리다이렉트 방지.
- **불변식**:
  - `handle_new_user`는 SECURITY DEFINER여야 함(가입 시 profiles 생성). 지우면 프로필 없는 유저 발생.
  - 가입 성공 ≠ 로그인. `needsEmailConfirmation`을 UI가 존중해야 함(“환영합니다”로 뭉개지 말 것).
  - 재설정 세션은 `/auth`가 아니라 `/auth/reset`에서만 소비.
- **변경 시 확인**: 가입→인증메일→로그인, 비번찾기→재설정, 로그인 후 `?chat=1` 딥링크 복귀.
- **주의(비차단)**: `signInWithGoogle`는 구현됐으나 UI 미연결(🧩 데드코드). 프로필 비번변경은 최소 6자인데 가입/재설정은 `passwordSchema`(더 강함) — 기준 불일치.

## 2. 책 등록  ✅
- **무엇**: `UploadBookForm`으로 `books` 행 생성. 제목 입력이 곧 카탈로그 검색(제목/저자/표지 자동완성).
- **데이터 흐름**: `books` INSERT (RLS: `auth.uid()=owner_id`). 표지는 사용자 사진 → 없으면 검색 매칭 표지. 사진은 Storage `book-covers`(공개 버킷). 등록 시 트리거 `trg_set_book_spine_color`(랜덤 1~6), `trg_notify_wishlist_match`(위시 매칭 알림), `trg_notify_community_new_book`(커뮤니티 새 책 알림).
- **불변식**:
  - 판매(sell) 책은 가격>0 + 사진 필수. 비공개 책은 커뮤니티 선택 필수.
  - `books.status`는 폼이 아니라 **거래가** 바꾼다(available↔rented/sold). 폼에서 직접 건드리지 말 것.
- **변경 시 확인**: 대여/판매/나눔 각각 등록, 공개/비공개, 커뮤니티 지정, 등록 후 서가 실시간 반영(`useBooks` realtime).
- **주의**: `EditBookModal`은 판매-사진 필수 검증이 없음(UploadBookForm과 불일치), 영어 토스트 잔존.

## 3. 거래 플로우: 요청 → 수락 → 반납  ✅ (단, 반납 리마인더는 🐛 — 4-1 참조)
> **이 앱의 심장.** 요청·수락·반납은 **전용 테이블이 아니라 접두사 붙은 채팅 메시지**로 흐른다. `transactions` 행은 *수락 시점*에만 생긴다.
- **무엇**: 책 상세 “요청” → 채팅방 자동 생성 + `[대여/구매/나눔 요청] … [BOOK_ID:uuid]` 메시지. 소유자가 수락(`AcceptRentalModal`, 날짜 입력) → `transactions` 생성 + `[대여 수락]/[판매 완료]/[나눔 완료]`. 반납은 `[반납 요청]`(대여자) → 소유자 확인 → `transactionHelpers.completeReturn`이 (1) `transactions.status=completed` (2) `books.status=available` (3) `[반납 완료]` 메시지 (4) `conversations.last_message_at` 갱신.
- **데이터 흐름**:
  - `messages` INSERT → 트리거 `notify_on_new_message`가 접두사 파싱해 `notifications`(book_request/request_accepted/return_requested/new_message) 생성.
  - 수락 시 `useTransactions.createTransaction`: `status = rent?'active':'completed'`(구매/나눔은 즉시 completed), `books.status`→sold/rented.
  - `transactions` INSERT/UPDATE → 트리거 `notify_transaction_completed`(return_completed/purchase_completed/first_transaction).
  - RLS: `messages` INSERT는 `auth.uid()=sender_id AND is_conversation_participant`. `transactions` INSERT는 **owner·borrower 모두 허용**(마이그레이션 `20260131045549`가 borrower-only 정책을 교체함 — 이거 되돌리면 수락이 깨진다).
- **불변식 (⚠️ 최중요)**:
  - **접두사 어휘는 4곳이 동기화돼야 함**: `ChatView.tsx`의 `RESERVED_PREFIXES`/`parseMessage`, `ConversationList.tsx`의 `SPECIAL_PREFIX_MAP`, SQL `notify_on_new_message`의 `prefix IN (...)`. 한 곳만 오타나도 메시지가 평문으로 뜨거나 알림 분류가 틀어진다.
  - **give/purchase 이중성**: `transactions.type`에는 `give`가 없다. 나눔 = `type='purchase'` + `price=NULL`. “판매냐 나눔이냐”는 반드시 `books.mode`로 판단(‑type으로 판단하면 틀림).
  - 중복 대화방 방지: `conversations` 유니크 인덱스(참여자쌍) + 앱단 23505 복구. 되돌리면 요청 1건에 방 2개.
  - **수락은 소유자가 `transactions`를 INSERT**한다 → INSERT 정책이 borrower-only면 깨짐(위 참조).
- **변경 시 확인**: 대여 요청→수락→반납요청→반납완료 왕복, 구매/나눔 즉시완료, 대여중 서가 dimming, 반납 후 `available` 복귀 + 대기자 알림.

## 4. 채팅  ✅
- **무엇**: 1:1 실시간 채팅, 읽음 표시, 이미지(QR) 첨부, 거래 카드(RentalMessageCard) 렌더.
- **데이터 흐름**: `conversations` + `messages`. `messages`는 realtime publication에 포함. `useChat`(목록/총 미읽음), `useMessages`(방 내부). 이미지는 `book-covers/chat/...`.
- **불변식**:
  - `messages`가 realtime publication에서 빠지면 실시간 채팅이 죽는다.
  - 거래 카드는 `isSpecialMessage && bookInfo`일 때만 렌더 — 책이 삭제되면 카드가 사라짐(평문도 안 뜸). 알아둘 엣지.
- **변경 시 확인**: 메시지 송수신 실시간, 읽음 배지, 이미지 업로드, 거래 카드 버튼 노출 로직.
- **주의**: `useChat`가 **모든** `messages` INSERT를 구독 후 refetch(정확하나 chatty). `conversations`는 publication에 없어 새 방은 첫 메시지의 refetch로만 나타남.

---

# P0 알림 파이프라인 (거래와 한 몸)

## 5. 알림 팬아웃 구조  ✅ (푸시 트리거는 ⚠️ 레포 밖)
- **무엇**: 모든 알림은 **한 테이블 `notifications`** 에서 갈라진다: (a) realtime→인앱 벨/토스트, (b) 트리거 `trg_notifications_push`→`send-push`(웹푸시), (c) 트리거 `trg_notifications_telegram`→`telegram-notify`(텔레그램).
- **데이터 흐름**: 각 DB 트리거 함수는 “`notifications` 행 하나 만들기”만 함. 전달(푸시/텔레그램)은 그 위에 얹힌다.
- **불변식 (🔴 트리거 안전 규칙 — 아래 별도 섹션)**.
- **⚠️ 주의**: `trg_notifications_push`(웹푸시 발송 트리거)는 **공유 비밀키 때문에 레포에 없음**(저장소 밖 관리, `scripts/push_subscriptions_table.sql` 참고). 마이그레이션만으로 DB를 재구축하면 인앱·텔레그램은 되지만 **웹푸시는 조용히 안 됨**. 재구축 시 이 트리거를 반드시 다시 적용.

## 6. 인앱 벨 + 딥링크  ✅
- **무엇**: 헤더 벨 + 미읽음 배지, 팝업(읽음/모두읽음/삭제), type→화면 라우팅.
- **데이터 흐름**: `notifications` 최근 50개 + user_id 필터 realtime. `notificationRoutes.ts`가 type→목적지 단일 소스. `npm run check:notifications`(CI 가드)가 DB가 넣는 모든 type이 라우트에 있는지 검사.
- **불변식**: 새 알림 type을 추가하면 **반드시** `NOTIFICATION_ROUTES`에도 추가(안 하면 죽은 링크 → 가드 스크립트가 잡음).
- **변경 시 확인**: `npm run check:notifications` 통과, 벨 클릭 시 해당 화면 이동.

## 7. 웹 푸시  ⚠️
- **무엇**: `push_subscriptions` 구독, `send-push` Edge Function(web-push+VAPID), SW `push`/`notificationclick` 핸들러.
- **데이터 흐름**: `usePushNotifications` 구독 upsert. `send-push`는 `x-push-secret` 필요, 404/410 구독 정리.
- **불변식**: `sw.ts`의 push 핸들러 + `skipWaiting/clientsClaim`(2026-07-31 추가) 유지. VAPID 키 없으면 UI가 정직하게 “준비 중” 표시.
- **주의**: 발송 트리거가 레포 밖(5번 참조). VAPID 미설정 시 미작동(정상 degrade).

## 8. 텔레그램 알림  ✅ (실사용 확인)
- **무엇**: 앱 미설치(=활성 푸시 구독 0) + 동의한 유저에게 **Tier1만** 텔레그램 발송: `book_request, request_accepted, return_due, return_overdue, waitlist_available`.
- **데이터 흐름**: `telegram-webhook`(`/start CODE`로 연동), `telegram-notify`(게이팅+발송), 트리거 `notify_telegram_tier1`(`supabase/telegram_trigger.sql`, 레포엔 있으나 마이그레이션 아님 — URL·시크릿 포함). `profiles.telegram_chat_id/opt_in/link_code`.
- **불변식 (사고 재발 방지)**: `notify_telegram_tier1`는 **반드시** `set search_path to 'public','net','extensions'` + `net.http_post`를 `BEGIN…EXCEPTION WHEN OTHERS THEN raise warning…END`로 감쌀 것. (둘 중 하나만 빠져도 대여요청/수락 메시지 INSERT가 통째로 실패 — 2026-07-30 실제 사고.)
- **변경 시 확인**: 다른 계정으로 대여요청 → (푸시 OFF 유저에게) 텔레그램 수신, 링크 클릭. 그리고 **반드시 대여요청/수락/반납 메시지가 여전히 저장되는지**.

---

# P1 — 핵심 경험

## 9. 서가 / 도서관 뷰  ✅
- **무엇**: `Bookshelf`(스파인 뷰, 메인). 범위(전체/내책/커뮤니티), 상태칩, 지역/정렬 필터, 검색, 중복 제거, 대여중 뒤로, 좋아요 위로.
- **데이터 흐름**: `useBooks({})`가 sold 제외 전량 + owner/community 조인, `books` realtime로 300ms 디바운스 refetch.
- **불변식**: sold 책은 서가에서 제외. 비공개 책은 커뮤니티 멤버에게만(RLS `is_community_member`).
- **주의**: `LibraryPage`/`BorrowedBooksTab`은 `/library` 프리뷰로만 접근 가능(🧩 정식 미도입). `BookCover`는 `MemberProfileModal`에서만 사용.

## 10. 책 상세 · 좋아요 · 위시리스트 · 대기열  ✅
- **책 상세**(`BookDetailWithActions`): 소유자정보/상태/같은 책 가진 이웃/대기열/좋아요/신고/모드별 CTA.
- **좋아요**(`liked_books`, UNIQUE(user,book)): 하트 + “관심 도서” FAB. ⚠️ 생성 types.ts에 없어 `as any` 캐스팅.
- **위시리스트**(`wishlists`): 갖고 싶은 책(좋아요와 별개). 이웃이 채팅으로 응답. 등록 시 위시 매칭 알림.
- **대기열**(`book_waitlist`, UNIQUE(book,user)): 대여중 책 줄서기. 반납되어 `available`되면 트리거 `notify_waitlist_on_available`가 **첫 대기자+소유자**에게 알림.
- **불변식**: 대기열은 **자동 배정 안 함**(알림만). 대기자는 성공 대여 후에도 자동 제거 안 됨(수동/책삭제 cascade). 알아둘 한계.
- **변경 시 확인**: 좋아요 토글, 위시 추가→채팅, 대기 등록→반납 시 알림.

## 11. 커뮤니티 (가입/게시판/책장)  ⚠️
- **무엇**: 커뮤니티 생성/가입(PIN·초대링크)/탈퇴, 멤버·역할·강퇴/밴, 게시판(글·댓글·책카드), 커뮤니티 책장.
- **데이터 흐름**: `communities`(+ `communities_public` 뷰), `community_members`(role, is_banned, kick_count, notifications_enabled, member_count), `community_posts`/`community_comments`, `books.community_id`. 초대는 SECURITY DEFINER `join_via_invite`(밴 인지, 서버 검증).
- **불변식**: 밴된 멤버는 재가입/게시판 접근 불가(RLS `is_banned`). 게시판 글/댓글은 비밀번호 아닌 **멤버십**으로 보호.
- **⚠️ 이슈**:
  - **PIN이 해시가 아니라 base64**(`btoa`)이고 `pin_hash`가 인증 유저에게 읽힘 → 클라 우회 가능. 서버 검증되는 유일한 경로는 초대링크. (보안 개선 필요)
  - **밴 시 `member_count` drift**: 밴은 UPDATE인데 `update_member_count` 트리거는 INSERT/DELETE에만 반응 → 밴 멤버가 카운트를 부풀림(목록엔 안 보임).
  - communities SELECT 정책 중복(`20260214084619`가 전체 공개로 재개방) → `pin_hash` 노출.
- **변경 시 확인**: 생성→자동 admin 가입, 초대링크 가입, 게시판 글/댓글 CRUD, 커뮤니티 책 필터(`?community=`).

## 12. 프로필 · 차단 · 신고  ✅
- **프로필**: 닉네임/아바타/국가/지역/성별/나이/소개. `profiles`(SELECT 전체 공개, UPDATE 본인). 아바타 Storage `avatars`. 닉네임 유니크 재검사(23505).
- **차단**(`blocked_users`): 양방향 `is_blocked_between()`가 `messages`/`books`/`conversations` RLS에 반영(클라 숨김 + 서버 차단).
- **신고**(`reports`, context 스냅샷, 신고자-대상 유니크). 관리자 해결 UI.
- **⚠️ 주의**: `profiles` SELECT가 전체 공개라 `gender`/`age`의 `*_public` 프라이버시가 **UI에서만** 걸림(원시 쿼리엔 노출). 이용약관 4조②가 “대한민국 거주자”라 코드(SG 전용)와 불일치.

---

# P2 — 부가 / 차별화

## 13. 가상공간 (Phaser)  ✅
- **무엇**: `/space`(전체 도서관), `/space/community/:id`(커뮤니티룸). 매니페스트 기반 룸, 상호작용 가구(게시판/책장), 캐릭터 에디터, 멀티플레이어(Presence), 오프라인 멤버 zzz, 이름표, 이모트 파티클, 근접 채팅, 읽는 책 말풍선(표지+클릭 상세).
- **데이터 흐름**: 정적 `manifest.json`. `profiles.pixel_avatar`(jsonb) + `reading_book`(jsonb 스냅샷)/`reading_book_id`. Realtime 채널 `space:global`/`space:community:{id}` — Presence(track: userId,nickname,avatar,readingBook,x,y,dir,moving) + broadcast(bubble). 원격 아바타는 캔버스 텍스처로 합성. 표지는 HTMLImageElement→텍스처(`loadCover`).
- **불변식**:
  - 저장된 아바타가 삭제된 에셋을 참조해도 죽지 않게: `loadImageSafe` + `clampToManifest` + 존재하는 텍스처만 필터(회귀 주의).
  - 입력 포커스 중 WASD 이동 억제.
  - 읽는 책 표지 텍스처/변경감지 키 = `id || coverUrl || title`(임의의 책은 id=null).
  - **전체 도서관 매니페스트엔 action(게시판/책장)이 없음** — 책장 클릭→책은 커뮤니티룸에서만.
- **변경 시 확인**: 캐릭터 저장→반영, 다른 접속자 표시/이동, 이모트, 근접 채팅, 읽는 책 검색 지정→말풍선 표지→클릭 상세. ⚠️ **마이그레이션 `20260731000002_reading_book_snapshot.sql`(profiles.reading_book jsonb) 실행 필요.**

## 14. 회원 탈퇴 · 관리자  ✅
- **탈퇴**: `delete-account` Edge Function(본인 JWT 검증→admin.deleteUser), 불가 시 PDPA 메일 폴백.
- **관리자**: `AdminPortal`(유저/책/신고/대시보드), 밴/해제 RPC(`admin_ban_user` 등, types 미포함 `as any`).

---

# 알려진 버그 · 리스크 (착수 후보)

| 심각도 | 항목 | 근거 | 영향 |
|---|---|---|---|
| 🐛 높음 | **반납 임박/연체 알림 미작동** | 크론 `notify_due_returns`/`notify_overdue_returns`가 `transactions.end_date`로 필터하는데, 앱은 `return_date`만 쓰고 `end_date`는 항상 NULL (`useTransactions.ts:124`) | 반납 D-1/D-day/연체 알림(벨+텔레그램 Tier1)이 **한 번도 안 뜸**. `BorrowedBooksTab`의 “Due …”도 안 뜸 |
| ⚠️ 높음 | **웹푸시 트리거 레포 밖** | `trg_notifications_push`가 저장소 밖 관리 | 마이그레이션만으로 재구축 시 웹푸시 조용히 누락 |
| ⚠️ 중 | **커뮤니티 PIN 우회 가능** | `btoa(pin)` + `pin_hash` 전체 공개 SELECT | PIN 방 무단 입장 가능 |
| ⚠️ 중 | **member_count drift(밴)** | 밴=UPDATE, 트리거는 INSERT/DELETE만 | 멤버 수 부정확 |
| ⚠️ 중 | **notify_on_new_message의 `::uuid` 무방비 캐스트** | AFTER INSERT + EXCEPTION 없음, `book_id_txt::uuid` | 비-UUID BOOK_ID가 들어오면 채팅 전송 자체가 실패(현재는 생산자가 항상 UUID라 안전) |
| ⚠️ 낮 | profiles gender/age 프라이버시 UI-only | SELECT 전체 공개 | 원시 쿼리로 노출 |
| ⚠️ 낮 | 이용약관 지역(KR) vs 코드(SG) 불일치 | `TermsPage` 4조② | 법적 문구 오류 |
| 🧩 | LibraryPage/BorrowedBooksTab 프리뷰, `signInWithGoogle` 데드코드 | `/library`만 진입, UI 미연결 | 정리 대상 |

---

# 트리거 안전 규칙
> 공용 테이블(`notifications`, `messages`, `transactions`, `books`)에 트리거를 붙일 때 **반드시**:

1. **외부 호출은 감싼다** — `net.http_post` 등은 `BEGIN … EXCEPTION WHEN OTHERS THEN raise warning … END`. 안 감싸면 발송 실패가 부모 INSERT를 롤백시켜 **거래가 마비**된다.
2. **pg_net 쓰는 함수는 `set search_path to 'public','net','extensions'`** — 빠지면 pg_net 내부 참조 실패(과거 OOM).
3. **AFTER INSERT 트리거에서 던지는 예외 = 부모 INSERT 롤백**. 타입 캐스트(`::uuid` 등) 같은 throw 지점을 조심.
4. **새 트리거/알림 추가 후 반드시** 대여 요청·수락·반납 메시지 저장(tier1 경로)을 **실제로 테스트**. `npm run build` + `npm run check:notifications`도 통과시킬 것.

**실제 사고 기록** — 2026-07-30 텔레그램 트리거 추가 시 `search_path` 누락 → `net.http_post` OOM → `[대여 요청]/[대여 수락]` 메시지 INSERT가 통째로 실패(핵심 거래 마비). search_path 지정 + EXCEPTION 래핑으로 해결.

---

_최종 갱신: 2026-07-31. 정적 QA + 빌드 통과 기준. 기능 변경 시 이 문서의 해당 항목 불변식/작동상태를 함께 갱신할 것._
