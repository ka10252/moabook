# QA 발견 리스트 (2026-08-01 감사)

4개 영역(핵심 거래 / 인증·프로필·위시 / 커뮤니티·가상공간 / 성능)을 코드 정독으로 감사한 결과.
각 항목: `[심각도]` 제목 — 파일:라인 — 증상/재현 — 수정안.
✅ = 이번에 이미 수정/처리됨.

---

## 🔴 High — 데이터 무결성·보안·치명적 플로우

1. **판매/나눔 중복 수락(더블 서브밋)** — `ChatView.tsx:335-337,472`
   `findActiveTransaction()`이 `status==='active'`만 보는데 판매·나눔은 `'completed'`로 생성됨 → 수락 후에도 버튼이 계속 활성 → 두 번째 거래행/`sold` 재설정/중복 `[판매 완료]` 메시지. **수정**: 책 status(sold/rented) 또는 해당 책의 모든 거래로 게이팅.

2. **나눔(무료) 책인데 수락 모달이 "판매/구매자"로 표시** — `ChatView.tsx:788` → `AcceptRentalModal.tsx:62-63,120-124,183-185`
   give/sell을 `'purchase'`로 뭉갬 → 무료 나눔인데 "판매합니다"로 안내. **수정**: 실제 `mode('give')`를 모달에 전달해 라벨 분기.

3. **커뮤니티 PIN이 해시가 아니라 base64, 클라이언트로 전송** — `JoinCommunityForm.tsx:46-56`, `CommunityDetailModal.tsx:143-150,326-327`
   `btoa(pin)` 저장/비교 + `pin_hash`를 클라가 직접 select → devtools에서 `atob`로 PIN 복원 가능. **수정**: `SECURITY DEFINER` RPC로 서버측 검증(진짜 해시), pin_hash 클라 전송 금지.

4. **3회 방출 영구차단이 절대 발동 안 함** — `CommunityDetailModal.tsx:220-238`
   kick_count 증가 직후 멤버십 행을 DELETE → 카운트 소멸, 재가입 시 0부터. **수정**: (community_id,user_id) 키의 별도 ban 기록 또는 `left_at` soft-delete.

5. **계정 삭제 후 로그인된 듯한 프로필 화면에 잔류** — `ProfilePage.tsx:376-394`
   삭제 성공 시 토스트만 띄우고 navigate 안 함 → 삭제된 닉네임/통계가 그대로, 이후 조작은 null 세션. **수정**: 성공 시 로그아웃 경로처럼 `navigate('/',{replace:true})`.

6. **게시판 딥링크에 멤버십 게이트 없음** — `Index.tsx:276-285`, 가상룸 게시판 가구도 동일
   `?board=<id>`만으로 CommunityBoard 렌더, 접근제어를 RLS에만 의존. **수정**: 렌더 전 멤버십 확인(또는 RLS가 비멤버 select/insert 차단하는지 하드 검증).

7. **커뮤니티룸 입장에 멤버십 체크 없음** — `VirtualSpacePage.tsx:130-207`
   비멤버도 manifest·멤버 로드 + presence 채널 join → 비멤버 아바타가 방에 브로드캐스트, 게시판 도달. **수정**: 로드 시 멤버십 확인, 비멤버는 토스트 후 리다이렉트.

---

## 🟠 Med — 플로우 갭·오작동

8. **한글 IME 조합 중 Enter가 반쪽 글자 전송** — `VirtualSpacePage.tsx:287`, `CommunityBoard.tsx:239`
   `isComposing` 가드 없음 → 마지막 자모 커밋 Enter가 전송도 트리거. **수정**: `if(e.key==='Enter' && !e.nativeEvent.isComposing)`.

9. **useTransactions 실시간 구독 없음 → 상대방 "거래 중" 배너 stale** — `useTransactions.ts:83-85`
   수락돼도 상대 화면 배너/거래 UI가 리마운트 전엔 안 바뀜. **수정**: transactions postgres_changes 구독(또는 수락/반납 메시지 수신 시 refetch).

10. **북픽커가 판매/나눔 책에 "대여 요청"을 보냄** — `ChatView.tsx:291-315`
    mode 없이 조회, `[대여 요청]` 하드코딩. **수정**: mode 조회해 접두사 분기(대여/구매/나눔 요청).

11. **상세시트가 `rented`만 처리, `sold` 미처리** — `BookDetailWithActions.tsx:379-396`
    찜/위시로 연 sold 책에 "구매하기/받기" CTA 노출. **수정**: `status==='sold'` 분기로 CTA 비활성("거래 완료").

12. **책 CTA 재진입 시 중복 요청 카드 누적** — `useChat.ts:247-262`, `ChatModal.tsx:67-95`
    이미 대화 있어도 매번 새 `[…요청]` 전송. **수정**: 같은 bookId 미해결 요청 있으면 전송 스킵.

13. **위시 삭제/찾음/메모 실패가 무피드백으로 삼켜짐** — `WishlistPage.tsx:186-188`, `useWishlist.ts:92-116`
    반환 error 무시, 다이얼로그는 결과와 무관하게 닫힘. **수정**: `toast.error`로 노출, 성공 후에만 닫기.

14. **"찾았어요"가 확인·되돌리기 없는 1탭 비가역** — `WishlistPage.tsx:187`
    오탭 시 카드 영구 사라짐, 조회/복구 UI 없음. **수정**: 확인 또는 undo 토스트 + 성공 피드백.

15. **위시 "메시지" 버튼 연타로 중복 문의 전송** — `WishlistPage.tsx:74-88`
    in-flight 가드 없음 → 동일 문의 3회 전송. **수정**: 실행 중 버튼 비활성.

16. **프로필 비번 변경이 가입/재설정보다 약한 비번 허용** — `ProfilePage.tsx:348-357`
    여기만 `length<6` 검사(가입은 passwordSchema). **수정**: `passwordSchema.safeParse` 통일.

17. **미인증 로그인 → "메일 확인" 전환에 쿨다운/폼리셋 없음** — `AuthPage.tsx:186-187`
    재발송 즉시 가능 → Supabase rate limit 유발. **수정**: `setResendCooldown(60)` + resetForm.

18. **비번 재설정 페이지가 유효 링크에도 "만료" 화면 깜빡** — `ResetPasswordPage.tsx:30-42`
    토큰 교환 전 `getSession()` null 레이스. **수정**: 짧은 grace 동안 스피너 유지.

19. **커버 미리보기 제거해도 파일은 그대로 업로드** — `CreateCommunityForm.tsx:176-177`
    remove가 preview만 지움. **수정**: `setCoverFile(null)`도.

20. **Create/Join 폼이 URL 아닌 로컬state → 안드로이드 뒤로가기가 탭 이탈** — `CommunityPage.tsx:38,230-259`
    **수정**: view를 URL에 인코딩 또는 useBackClose.

21. **가상룸 "나가기" navigate(-1)로 사이트 이탈 가능** — `VirtualSpacePage.tsx:214`
    공유링크로 첫 진입 시 히스토리 없음. **수정**: 히스토리 없으면 `navigate('/?tab=community')`.

22. **첫 입장 시 캐릭터에디터+사서 투어 동시 표시** — `VirtualSpacePage.tsx:177` + `LibraryScene.ts:711-713`
    둘 다 z-70로 겹침, 투어 하이라이트가 안 보이는 씬을 가리킴. **수정**: 에디터 닫힘/아바타 존재 조건으로 auto-tour 게이팅.

23. **Phaser 게임이 user 객체 정체성 변할 때마다 파괴·재생성** — `VirtualSpacePage.tsx:130-207`
    토큰 리프레시가 새 user 참조 → 게임 teardown/rebuild 깜빡임·presence churn. **수정**: deps를 `user?.id`로.

24. **알림 탭이 라우팅 데이터 없으면 조용한 무반응** — `NotificationPopup.tsx:128-172`
    **수정**: 관련 탭 폴백 열기 또는 "열 수 없어요" 토스트.

---

## 🟡 Low — 다듬기

25. **아바타 file input value 미리셋 → 실패 후 같은 파일 재선택 불가** — `ProfilePage.tsx:300-346` (`e.target.value=''`).
26. **텔레그램 "연결" 더블탭이 첫 코드 무효화** — `TelegramSettings.tsx:36-44`(+`NotificationPopup.tsx`,`OnboardingModal.tsx`). in-flight 가드.
27. **위시 검색창 Enter가 부모 폼 submit → 헛 에러 토스트** — `AddWishlistForm.tsx:74-105`. search 모드 Enter preventDefault.
28. **게시글/댓글 삭제에 확인 없음** — `CommunityBoard.tsx:157,216`. 다른 파괴적 액션과 달리 즉시 삭제.
29. **댓글 작성 후 접힌 토글의 "댓글 N" stale** — `CommunityBoard.tsx:119-129 vs 176`.
30. **kick 후 헤더 멤버수 stale** — `CommunityDetailModal.tsx:383`(member_count prop 미갱신).
31. **알림 팝업 열려있는 동안 도착한 알림은 미읽음 잔류** — `NotificationPopup.tsx:114-122`.
32. **알림 삭제 즉시·undo 없음** — `NotificationPopup.tsx:278-286`.
33. **이미지 전송/북픽커가 send 실패해도 성공 토스트** — `ChatView.tsx:94,313-314`. 반환 error 검사.
34. **`[반납 요청]` 데드 코드** — `ChatView.tsx:195-203,482-485`, `RentalMessageCard.tsx:180-189`. '반납했어요' 제거로 도달 불가. 정리.
35. **sendMessage가 message 후 last_message_at 별도 patch(비원자)** — `useChat.ts:269-283`. DB 트리거로 이관 권장.

---

## ⚡ 성능 (이번에 구현 완료 ✅ / 권장)

- ✅ **vendor 코드 스플리팅**: 단일 index 972KB(290gz) → index 328KB(96gz) + react/supabase/radix/motion/query 캐시가능 청크. 앱코드 변경 시 캐시 무효화 범위 대폭 축소.
- ✅ **대형폰트 precache 제외**: Galmuri11(496KB)·Noto Sans KR(559KB)를 SW 프리캐시에서 제외 → 설치 payload 축소.
- ✅ **이미지 lazy 로딩**: 책표지·아바타 img에 `loading=lazy`.
- ⏳ **Noto Sans KR 559KB 서브셋/대체** (권장, 미구현): 책등 세로라벨 전용인데 첫 화면에서 로드. glyphhanger 서브셋 또는 Galmuri/시스템폰트 대체 시 첫 로드 400KB+ 절감. **시각 변경이라 승인 필요.**
- ⏳ **framer-motion(120KB/40gz)을 eager 경로에서 축출** (권장): 셸프의 Bookshelf/BookCover/BookSpine이 eager 사용. 단순 애니메이션은 CSS로 대체 시 첫 로드 감소(대규모 리팩터).
- ⏳ **useBooks `select('*')` → 명시 컬럼 + 페이지네이션** (권장): 책 변경마다 전체 조인 재조회. 컬럼 명시로 payload 축소(전수 확인 필요).
