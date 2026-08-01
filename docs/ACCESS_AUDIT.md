# 접근 권한 감사 (게스트/비로그인) — 2026-08-02

anon 키로 REST 실측 + 라우트 가드 코드 확인. "게스트가 봐도 되는 것/안 되는 것"이 의도대로인지 점검.

## 라우트 (App.tsx) — 전부 public 라우터, 가드는 컴포넌트 내부
| 경로 | 게스트 | 가드 방식 |
|---|---|---|
| `/` (홈/서가) | ✅ 열람 가능 | 액션(대여·하트·업로드)만 `requireAuth`로 로그인 유도 |
| `/auth`, `/auth/reset` | ✅ | — |
| `/terms`, `/privacy` | ✅ | — |
| `/library` (프리뷰) | ✅ | 프리뷰 전용 |
| `/space`, `/space/community/:id` | ⚠️ | VirtualSpacePage 내부 멤버십 게이트 |
| `/admin-portal` | ⛔ | useAdminAuth → 비관리자 redirect('/') |
| `*` | NotFound | — |

→ 라우트 가드는 의도대로. 관리자 포털은 내부에서 차단됨(직접 URL 쳐도 홈으로 튕김).

## 데이터 (테이블별 anon 접근)
| 테이블 | 결과 | 판정 |
|---|---|---|
| books | 200 데이터 | ✅ 공개 의도 |
| wishlists | 200 데이터 | ✅ 공개 의도 |
| site_announcements | 200 데이터 | ✅ 공개 의도 |
| communities | 200 **0행** | ✅/❔ 멤버/가입 전용이거나 데이터 없음 — 커뮤니티 "탐색" 필요하면 정책 확인 |
| community_members | 200 0행 | ✅ RLS |
| messages·conversations·transactions·notifications·liked_books·book_waitlist | 200 0행 | ✅ 유저 스코프 RLS(게스트=빈결과) |
| user_roles | 200 0행 | ✅ 본인 역할만(게스트=없음) |
| reports·blocked_users·feedback·events·push_subscriptions | 401 / 42501 | ✅ 정상 차단 |
| **profiles** | 200 (허용 컬럼만) | 🟠 **아래 이슈** |

## 🟠 발견된 이슈 (profiles) → 항목7에서 수정
- `telegram_chat_id` : anon도 읽힘. 남의 텔레그램 ID 노출(악용 소지). 노출 불필요.
- `gender`, `age` : `gender_public`/`age_public` 토글을 **무시하고** anon도 원본값 읽힘("비공개"가 실제론 공개).
- `district`/`region` : 거주 지역 전체 공개.
- (참고) `select=*` 는 42501 — 미허용 컬럼(telegram_link_code) 덕에 전체선택은 이미 막힘. 개별 컬럼은 위처럼 읽힘.
- **해결**: `profiles_public` 뷰(안전 컬럼만, gender/age는 _public일 때만) + 남의 프로필 조회를 뷰로 이전, telegram_chat_id는 본인만.

## 기타 관찰(비차단, 참고)
- 알림 딥링크 `onOpenCommunity`가 community_id를 안 써서 특정 커뮤니티가 아닌 커뮤니티 탭으로만 이동(사소 UX).
- PrivacyPage 최소연령 "만 14세"는 한국 PIPA 기준값 — SG는 명시 기준 없음. 보수적이라 유지, 필요시 법률 검토.
