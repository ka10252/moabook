# 핵심 퍼널 지표 정의 — 2026-08-02

관리자 지표 대시보드(`/admin-portal` → 지표)의 숫자를 **일관되게 해석**하기 위한 정의서.
이벤트는 `events` 테이블(`src/lib/analytics.ts`의 `track()`), 집계는 admin 전용 RPC.

## 활성화 퍼널 (가입 → 첫 책 등록 → 첫 거래)

| 단계 | 이벤트 | 의미 | 측정 위치 |
|---|---|---|---|
| 1. 방문 | `session_start` | 앱을 연 세션 | overview.sessions |
| 2. 가입 | `signup_completed` | 회원가입 완료 | overview.signups |
| 3. 온보딩 완료 | `onboarding_completed` | 첫 안내 끝까지 | overview.onboarding_done |
| 4. **첫 책 등록** | `book_upload_completed` | 공급자로 진입(핵심) | events 원자료 ※ |
| 5. 요청 | `request_sent` | 대여/나눔/구매 요청 | overview.requests |
| 6. 거래 완료 | transactions.status='completed' | 실제 거래 성사 | get_user_public_stats / admin |

※ `book_upload_completed`는 2026-08-02에 실제 발사 추가함(그전엔 타입만 있고 미측정). 
   지금은 events에 쌓이지만 `admin_metrics_overview`엔 아직 카운트로 안 들어감 → 필요 시 다음 마이그에서 추가.

**전환율 정의**
- 가입 전환 = signups / sessions
- 활성화 전환 = book_upload_completed(고유 유저) / signups  ← "가입했는데 책을 올렸나"
- 거래 전환 = 거래완료 유저 / book_upload 유저

## 공급·수요 신호
| 지표 | 이벤트/소스 | 해석 |
|---|---|---|
| 검색 | `search_performed` | 수요(무엇을 찾나) |
| 결과 없음 | `search_no_result` | **공급 부족**(있어야 할 책이 없음) → admin_top_no_result |
| 결과없음 비율 | no_result / searches | 높을수록 공급 부족 심각 |
| 대여 게이트 | `borrow_gate_shown` | 책 없어 요청 막힌 사람 |
| 게이트 전환 | admin_borrow_gate_conversion | 게이트 본 뒤 책 등록한 비율(콜드스타트 핵심) |

## 리텐션 (근사)
- `admin_daily_active`: 일자별 활성 유저/세션(SGT 기준). 재방문 추세.
- 정식 코호트 리텐션(D1/D7)은 아직 없음 — 필요 시 events created_at + user_id로 별도 RPC.

## 온보딩 이탈
- `onboarding_step`(단계별) vs `onboarding_completed`/`onboarding_skipped` 비교로 어느 단계에서 빠지는지.

## 주의
- 게스트(anon)는 user_id 없이 session_id/anon_id로만 잡힘 → 가입 전 행동은 세션 기준.
- 숫자는 "지어내지 않기" 원칙: 전부 events/DB 실측. 정의 바뀌면 이 문서를 먼저 고칠 것.
