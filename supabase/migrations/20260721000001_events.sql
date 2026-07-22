-- 행동 로그(이벤트) 테이블.
--
-- 지금까지는 "결과물"(책, 거래, 프로필)만 있고 "행동"이 없었다.
-- 그래서 "왜 안 쓰는가"에 답할 데이터가 0이었다 — 들어와서 아무것도 안 하고 나간 사람,
-- 검색했는데 없던 책, 온보딩 이탈 지점을 전혀 몰랐다.
--
-- 외부 도구(GA4/Amplitude) 없이 테이블 하나로 간다. 비용 0, 개인정보는 우리 DB 안에만.

CREATE TABLE IF NOT EXISTS public.events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- 로그인 안 한 게스트도 찍어야 한다 (전환 퍼널의 시작점이 게스트다) → nullable
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 게스트를 세션 단위로 묶는 익명 id. 가입 전 행동을 한 사람으로 이을 수 있다.
  anon_id    text,
  event      text NOT NULL,
  -- 이벤트별 부가정보. book_id, query, from 화면 등. 스키마를 안 바꾸고 늘릴 수 있다.
  props      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- 세션 구분용. 한 번 앱을 연 것을 하나로 본다.
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 분석 쿼리는 대부분 "이 이벤트를 시간순으로" 또는 "이 유저의 여정"이다.
CREATE INDEX IF NOT EXISTS events_event_time_idx ON public.events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS events_user_time_idx  ON public.events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_session_idx    ON public.events (session_id);
-- props 안을 조건으로 자주 뒤진다 (예: 특정 book_id를 본 사람)
CREATE INDEX IF NOT EXISTS events_props_gin_idx  ON public.events USING gin (props);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- ── 권한 ───────────────────────────────────────────────────
-- 로그는 오직 "쌓기"만 한다. 프론트에서 읽거나 고치거나 지울 수 있으면 안 된다.
-- 분석은 관리자가 service_role(대시보드/서버)로만 조회한다.
GRANT INSERT ON public.events TO anon, authenticated;
GRANT SELECT ON public.events TO service_role;

-- 게스트(anon)도 자기 행동을 남길 수 있어야 전환 퍼널이 완성된다.
-- 단, user_id를 남의 것으로 위조하지 못하게 막는다.
DROP POLICY IF EXISTS "events - insert own or anon" ON public.events;
CREATE POLICY "events - insert own or anon" ON public.events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    -- 로그인 상태면 자기 자신으로만, 게스트면 user_id는 비워야 한다
    user_id IS NULL OR user_id = auth.uid()
  );

-- 아무도 SELECT/UPDATE/DELETE 정책이 없다 = 프론트에서는 읽기·수정·삭제 불가.
-- 로그는 한번 쌓이면 유저가 손댈 수 없어야 신뢰할 수 있다.

COMMENT ON TABLE public.events IS
  '행동 로그. 프론트에서 track()으로 INSERT만. 분석은 service_role로 조회.';
