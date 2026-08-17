-- 배지 난이도 조정 (F20 1차)
--   · 새내기(책 1권 등록) 폐지 — 가입 직후 자동으로 붙어 성취가 아니었다
--   · 사서: 1/5/15 → 5/15/30 — 1회는 '첫 거래 도장'과 겹쳤다
--
-- 이미 발급된 배지는 회수한다. 지금 데이터는 실유저가 아니라 테스트분이고,
-- 안 지우면 새 기준과 화면에 찍힌 배지가 어긋난 채로 남는다.
--
-- ⚠️ 실유저가 생긴 뒤에 기준을 또 올릴 때는 이 DELETE를 그대로 쓰지 말 것.
--    받았던 배지가 사라지는 건 유저에게 버그로 읽힌다. 그때는 기준만 올리고
--    기존 발급은 남겨두는 쪽(award_badges의 소급 발급 기본 동작)이 맞다.

DELETE FROM public.user_badges WHERE badge_key = 'newbie';
DELETE FROM public.user_badges WHERE badge_key = 'librarian';

CREATE OR REPLACE FUNCTION public.award_badges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  -- 출시일. elder(터줏대감: 출시 후 2주 이내 가입) 판정 기준.
  v_launch date := DATE '2026-08-04';
  v_books int; v_completed int; v_lent int; v_borrowed_ret int; v_given int;
  v_joined int; v_santa int; v_posts int; v_hosted int; v_streak int;
  v_created timestamptz;
  newly jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required' USING ERRCODE = '42501'; END IF;

  SELECT count(*) INTO v_books FROM public.books WHERE owner_id = uid;
  SELECT count(*) INTO v_completed FROM public.transactions
    WHERE status = 'completed' AND (owner_id = uid OR borrower_id = uid);
  SELECT count(*) INTO v_lent FROM public.transactions
    WHERE status = 'completed' AND owner_id = uid AND type = 'rent';
  SELECT count(*) INTO v_borrowed_ret FROM public.transactions
    WHERE status = 'completed' AND borrower_id = uid AND type = 'rent';
  SELECT count(*) INTO v_given FROM public.transactions t
    JOIN public.books b ON b.id = t.book_id
    WHERE t.status = 'completed' AND t.owner_id = uid AND b.mode = 'give';
  SELECT count(*) INTO v_joined FROM public.community_members
    WHERE user_id = uid AND coalesce(is_banned, false) = false;
  SELECT count(*) INTO v_santa FROM public.books b
    JOIN public.wishlists w ON lower(trim(b.title)) = lower(trim(w.title))
    WHERE b.owner_id = uid AND w.user_id <> uid;
  SELECT count(*) INTO v_posts FROM public.community_posts WHERE author_id = uid;
  SELECT count(*) INTO v_hosted FROM public.communities WHERE created_by = uid;
  SELECT created_at INTO v_created FROM public.profiles WHERE id = uid;

  -- 개근상: session_start가 있는 주(SGT) 중 최장 연속 주 수
  SELECT coalesce(max(cnt), 0) INTO v_streak FROM (
    SELECT count(*) AS cnt FROM (
      SELECT wk, row_number() OVER (ORDER BY wk) AS rn FROM (
        SELECT DISTINCT date_trunc('week', created_at AT TIME ZONE 'Asia/Singapore') AS wk
        FROM public.events WHERE user_id = uid AND event = 'session_start'
      ) d
    ) o GROUP BY (wk - rn * interval '1 week')
  ) g;

  WITH q(k, t) AS (
    -- newbie 폐지
                    SELECT 'shelf',     CASE WHEN v_books >= 30 THEN 3 WHEN v_books >= 10 THEN 2 ELSE 1 END WHERE v_books >= 3
    UNION ALL SELECT 'firstdeal', 0  WHERE v_completed >= 1
    -- 사서: 5 / 15 / 30
    UNION ALL SELECT 'librarian', CASE WHEN v_lent >= 30 THEN 3 WHEN v_lent >= 15 THEN 2 ELSE 1 END WHERE v_lent >= 5
    UNION ALL SELECT 'ontime',    0  WHERE v_borrowed_ret >= 5
    UNION ALL SELECT 'giver',     0  WHERE v_given >= 3
    UNION ALL SELECT 'resident',  0  WHERE v_joined >= 1
    UNION ALL SELECT 'santa',     0  WHERE v_santa >= 1
    UNION ALL SELECT 'salon',     0  WHERE v_posts >= 10
    UNION ALL SELECT 'streak',    0  WHERE v_streak >= 4
    UNION ALL SELECT 'host',      0  WHERE v_hosted >= 1
    UNION ALL SELECT 'elder',     0  WHERE v_created::date <= v_launch + 14
  ),
  ins AS (
    INSERT INTO public.user_badges (user_id, badge_key, tier)
    SELECT uid, k, t FROM q
    ON CONFLICT (user_id, badge_key)
      DO UPDATE SET tier = EXCLUDED.tier
      WHERE EXCLUDED.tier > user_badges.tier   -- 티어 상승만 갱신
    RETURNING badge_key, tier
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('key', badge_key, 'tier', tier)), '[]'::jsonb)
  INTO newly FROM ins;

  RETURN newly;   -- 새로 땄거나 티어 오른 배지 [{key,tier},...]
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_badges() TO authenticated;
