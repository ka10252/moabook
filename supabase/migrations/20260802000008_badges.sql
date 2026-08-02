-- 활동 배지 (A안: 12종 — 데이터로 판정 가능한 것만. 11 책벌레/13 마당발/14 잡식가는 추적·장르 선행 필요라 보류).
--
-- 조건 판정은 반드시 서버(SECURITY DEFINER)에서. 프론트 판정은 조작 가능.
-- award_badges()가 유저의 전체 이력을 훑어 자격 있는 배지를 upsert하고, '새로 딴 것'만 돌려준다(토스트용).
-- 이력 전체를 보므로 출시 후 소급 발급도 자동(첫 호출 시 다 들어옴).

-- ── 저장 ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key  text NOT NULL,
  tier       smallint NOT NULL DEFAULT 0,   -- 티어 없는 배지=0, 티어 배지=1~3
  earned_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_key)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- 배지는 공개 신뢰 신호 → 누구나 조회 가능. 쓰기는 RPC(SECURITY DEFINER)로만.
GRANT SELECT ON public.user_badges TO anon, authenticated;
DROP POLICY IF EXISTS "user_badges public read" ON public.user_badges;
CREATE POLICY "user_badges public read" ON public.user_badges FOR SELECT USING (true);
-- INSERT/UPDATE 정책 없음 = 프론트에서 직접 못 씀(오직 award_badges).

-- 대표 배지 + 공개 여부 (프로필에)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS featured_badge text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges_public boolean NOT NULL DEFAULT true;
-- 20260801000005에서 profiles는 허용 컬럼만 SELECT 됨 → 새 컬럼 명시 GRANT
GRANT SELECT (featured_badge, badges_public) ON public.profiles TO anon, authenticated;

-- profiles_public 뷰에 대표배지/공개여부 추가 (남이 보는 대표 배지용)
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
SELECT
  id, nickname, avatar_url, bio,
  pixel_avatar, reading_book, reading_book_id,
  country, district, region, school,
  gender_public, age_public,
  CASE WHEN gender_public THEN gender END AS gender,
  CASE WHEN age_public    THEN age    END AS age,
  featured_badge, badges_public,
  created_at, updated_at
FROM public.profiles;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- ── 판정 + 발급 ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_badges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  -- ⚠️ 출시일. elder(터줏대감: 출시 후 2주 이내 가입) 판정 기준. 실제 출시일로 수정할 것.
  v_launch date := DATE '2026-08-15';
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
                    SELECT 'newbie',    0  WHERE v_books >= 1
    UNION ALL SELECT 'shelf',     CASE WHEN v_books >= 30 THEN 3 WHEN v_books >= 10 THEN 2 ELSE 1 END WHERE v_books >= 3
    UNION ALL SELECT 'firstdeal', 0  WHERE v_completed >= 1
    UNION ALL SELECT 'librarian', CASE WHEN v_lent >= 15 THEN 3 WHEN v_lent >= 5 THEN 2 ELSE 1 END WHERE v_lent >= 1
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
