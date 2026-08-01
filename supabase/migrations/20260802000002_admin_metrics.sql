-- 관리자 지표(행동 퍼널) 집계 RPC.
--
-- events 테이블은 service_role만 SELECT 할 수 있다(프론트에서 직접 못 읽음).
-- 그래서 어드민 포털이 퍼널 지표를 보려면, 집계만 돌려주는 SECURITY DEFINER 함수가 필요하다.
-- 각 함수는 has_role(admin)로 게이트한다 — 일반 유저가 호출하면 42501로 거절.
--
-- 원자료(누가 무엇을)는 절대 반환하지 않는다. 오직 "합계/개수"만 나간다.

-- ── 0) 공통: 어드민 가드 ──────────────────────────────────────
-- 각 함수 첫 줄에서 호출. 관리자가 아니면 예외.

-- ── 1) 개요: 최근 N일 헤드라인 숫자 한 방에 ────────────────────
DROP FUNCTION IF EXISTS public.admin_metrics_overview(int);
CREATE FUNCTION public.admin_metrics_overview(p_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - (greatest(p_days, 1) || ' days')::interval;
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'days', greatest(p_days, 1),
    'sessions',            count(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL),
    'active_users',        count(DISTINCT user_id)    FILTER (WHERE user_id IS NOT NULL),
    'signups',             count(*) FILTER (WHERE event = 'signup_completed'),
    'logins',              count(*) FILTER (WHERE event = 'login_completed'),
    'onboarding_done',     count(*) FILTER (WHERE event = 'onboarding_completed'),
    'onboarding_skipped',  count(*) FILTER (WHERE event = 'onboarding_skipped'),
    'book_views',          count(*) FILTER (WHERE event = 'book_viewed'),
    'requests',            count(*) FILTER (WHERE event = 'request_sent'),
    'searches',            count(*) FILTER (WHERE event = 'search_performed'),
    'no_result_searches',  count(*) FILTER (WHERE event = 'search_no_result'),
    'borrow_gate_shown',   count(*) FILTER (WHERE event = 'borrow_gate_shown'),
    'total_events',        count(*)
  )
  INTO v_result
  FROM public.events
  WHERE created_at >= v_since;

  RETURN v_result;
END;
$$;

-- ── 2) 이벤트별 건수 (최근 N일) ───────────────────────────────
DROP FUNCTION IF EXISTS public.admin_event_counts(int);
CREATE FUNCTION public.admin_event_counts(p_days int DEFAULT 7)
RETURNS TABLE(event text, cnt bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT e.event, count(*)::bigint AS cnt
  FROM public.events e
  WHERE e.created_at >= now() - (greatest(p_days, 1) || ' days')::interval
  GROUP BY e.event
  ORDER BY cnt DESC;
END;
$$;

-- ── 3) 결과 없던 검색어 TOP (공급 부족 신호) ──────────────────
DROP FUNCTION IF EXISTS public.admin_top_no_result(int, int);
CREATE FUNCTION public.admin_top_no_result(p_days int DEFAULT 30, p_limit int DEFAULT 20)
RETURNS TABLE(query text, cnt bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT lower(trim(e.props->>'query')) AS query, count(*)::bigint AS cnt
  FROM public.events e
  WHERE e.event = 'search_no_result'
    AND e.created_at >= now() - (greatest(p_days, 1) || ' days')::interval
    AND coalesce(trim(e.props->>'query'), '') <> ''
  GROUP BY lower(trim(e.props->>'query'))
  ORDER BY cnt DESC
  LIMIT greatest(p_limit, 1);
END;
$$;

-- ── 4) 일자별 활성(DAU) ───────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_daily_active(int);
CREATE FUNCTION public.admin_daily_active(p_days int DEFAULT 14)
RETURNS TABLE(day date, users bigint, sessions bigint, ev_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (e.created_at AT TIME ZONE 'Asia/Singapore')::date AS day,
    count(DISTINCT e.user_id)    FILTER (WHERE e.user_id IS NOT NULL)    AS users,
    count(DISTINCT e.session_id) FILTER (WHERE e.session_id IS NOT NULL) AS sessions,
    count(*)::bigint AS ev_count
  FROM public.events e
  WHERE e.created_at >= now() - (greatest(p_days, 1) || ' days')::interval
  GROUP BY 1
  ORDER BY 1;
END;
$$;

-- ── 5) 대여 게이트 전환 (책 없어서 막힌 사람 → 책 등록했나) ────
DROP FUNCTION IF EXISTS public.admin_borrow_gate_conversion(int);
CREATE FUNCTION public.admin_borrow_gate_conversion(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - (greatest(p_days, 1) || ' days')::interval;
  v_shown_events bigint;
  v_shown_users bigint;
  v_converted_users bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  SELECT count(*), count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)
  INTO v_shown_events, v_shown_users
  FROM public.events
  WHERE event = 'borrow_gate_shown' AND created_at >= v_since;

  -- 게이트를 본 로그인 유저 중, 현재 책을 1권 이상 가진 사람(= 등록으로 전환)
  SELECT count(DISTINCT g.user_id)
  INTO v_converted_users
  FROM (
    SELECT DISTINCT user_id
    FROM public.events
    WHERE event = 'borrow_gate_shown'
      AND created_at >= v_since
      AND user_id IS NOT NULL
  ) g
  WHERE EXISTS (SELECT 1 FROM public.books b WHERE b.owner_id = g.user_id);

  RETURN jsonb_build_object(
    'days', greatest(p_days, 1),
    'shown_events', coalesce(v_shown_events, 0),
    'shown_users', coalesce(v_shown_users, 0),
    'converted_users', coalesce(v_converted_users, 0),
    'conversion_rate', CASE WHEN coalesce(v_shown_users,0) > 0
      THEN round(100.0 * v_converted_users / v_shown_users, 1)
      ELSE 0 END
  );
END;
$$;

-- ── 권한: 로그인 유저에게 EXECUTE 허용(내부에서 admin 가드) ────
GRANT EXECUTE ON FUNCTION public.admin_metrics_overview(int)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_event_counts(int)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_top_no_result(int, int)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_daily_active(int)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_borrow_gate_conversion(int)  TO authenticated;
