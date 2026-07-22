# 이벤트 스키마 (행동 로그)

> 단일 진실 공급원은 `src/lib/analytics.ts` 의 `EventName` 타입이다.
> 이 문서는 그걸 사람이 읽을 수 있게 풀어쓴 것. 이벤트를 추가하면 **양쪽 다** 갱신할 것.

## 저장 위치

`public.events` 테이블 (마이그레이션 `20260721000001_events.sql`)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | bigint | 자동 증가 PK |
| `user_id` | uuid \| null | 로그인 유저. **게스트는 null** |
| `anon_id` | text | 게스트를 한 사람으로 잇는 익명 id (localStorage) |
| `event` | text | 아래 이벤트 이름 |
| `props` | jsonb | 이벤트별 부가정보 |
| `session_id` | text | 이번 앱 사용을 묶는 세션 id (sessionStorage) |
| `created_at` | timestamptz | 발생 시각 |

## 접근 규칙 (RLS)

- **프론트: INSERT만 가능.** 읽기·수정·삭제 불가. 로그는 한번 쌓이면 유저가 손댈 수 없어야 신뢰할 수 있다.
- **분석: `service_role`만 SELECT.** 관리자 대시보드/서버에서만 조회.
- 게스트(anon)도 INSERT 가능하되, `user_id`는 자기 자신이거나 null이어야 한다 (남의 것 위조 차단).

## 원칙

1. **앱을 절대 느리게/멈추게 하지 않는다.** `track()`은 await 하지 않고, 실패는 삼킨다.
2. **개인정보를 props에 넣지 않는다.** "무엇을 눌렀나"지 "무슨 내용을 썼나"가 아니다.
   - 예외: **검색어**(`query`). 공급 부족을 알려면 "무엇을 찾았나"가 핵심 신호라 불가피하게 담는다.
     대신 보관 기간을 짧게 둔다 (아래 개인정보 검토 참고).

---

## 이벤트 목록

### 세션 · 전환 퍼널

| 이벤트 | props | 언제 | 답하는 질문 |
|---|---|---|---|
| `session_start` | — | 앱 진입(게스트 포함), 세션당 1회 | 며칠에 한 번 오나 (리텐션) |
| `guest_gate_shown` | — | 게스트 제한 안내가 뜸 | 게스트가 벽에 부딪히는 빈도 |
| `signup_started` | — | 가입 폼 진입 | 가입 시작률 |
| `signup_completed` | `pending_confirmation` | 가입 성공 | 게스트→가입 전환율 |
| `login_completed` | — | 로그인 성공 | 재방문 |

### 온보딩

| 이벤트 | props | 언제 |
|---|---|---|
| `onboarding_step` | `step` (intro/borrow/upload/bookmark/push/done) | 다음 단계로 이동 |
| `onboarding_completed` | — | 끝까지 봄 |
| `onboarding_skipped` | `step` | 중간에 건너뜀 — **어디서 이탈하는지의 핵심** |

### 탐색

| 이벤트 | props | 언제 |
|---|---|---|
| `tab_viewed` | `tab` | 탭 이동 |
| `book_viewed` | `book_id`, `from` | 책 상세 열기 |
| `search_performed` | `query`, `result_count` | 검색 (타이핑 멈춘 뒤 1회) |
| `search_no_result` | `query` | 검색 결과 0건 — **공급 부족 신호** |
| `filter_applied` | `filter`, `value` | 필터 적용 |

### 거래 퍼널

| 이벤트 | props | 언제 |
|---|---|---|
| `request_started` | — | 대여/나눔/구매 신청 버튼 누름 |
| `request_sent` | `book_id`, `mode` | 요청 메시지 발송 — **수요의 실체** |
| `request_accepted` | `book_id` | 책 주인이 수락 |
| `return_completed` | `book_id` | 반납 완료 |

### 공급

| 이벤트 | props | 언제 |
|---|---|---|
| `book_upload_started` | — | 책 등록 시작 |
| `book_upload_completed` | `mode`, `has_photo` | 책 등록 완료 |
| `wishlist_added` | `title` | 위시리스트 추가 |

### 관여

| 이벤트 | props | 언제 |
|---|---|---|
| `notification_opened` | `type` | 알림 눌러서 이동 |
| `chat_opened` | — | 채팅 열기 |
| `push_enabled` | — | 푸시 알림 켬 |

---

## 분석 예시 쿼리

**게스트 → 가입 전환율**
```sql
SELECT
  count(*) FILTER (WHERE event='session_start')    AS 방문,
  count(*) FILTER (WHERE event='signup_completed') AS 가입,
  round(100.0 * count(*) FILTER (WHERE event='signup_completed')
        / nullif(count(*) FILTER (WHERE event='session_start'),0), 1) AS 전환율_pct
FROM public.events;
```

**공급 부족: 사람들이 찾는데 없는 책 Top 10**
```sql
SELECT props->>'query' AS 검색어, count(*) AS 횟수
FROM public.events WHERE event='search_no_result'
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
```

**조회 → 신청 전환 (수요의 실체)**
```sql
SELECT
  count(*) FILTER (WHERE event='book_viewed')  AS 조회,
  count(*) FILTER (WHERE event='request_sent') AS 신청,
  round(100.0 * count(*) FILTER (WHERE event='request_sent')
        / nullif(count(*) FILTER (WHERE event='book_viewed'),0), 1) AS 전환율_pct
FROM public.events;
```

**온보딩 이탈 지점**
```sql
SELECT props->>'step' AS 이탈단계, count(*) AS 명수
FROM public.events WHERE event='onboarding_skipped'
GROUP BY 1 ORDER BY 2 DESC;
```
