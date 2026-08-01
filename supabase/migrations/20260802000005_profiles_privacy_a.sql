-- 프로필 프라이버시 (A: 추가 전용 — 뷰 + RPC). 이것만으로는 아무것도 깨지지 않는다.
-- 실제 컬럼 잠그기(REVOKE)는 코드 배포·검증 후 20260802000006(B)에서 한다.
--
-- 문제(감사 결과, docs/ACCESS_AUDIT.md):
--   profiles의 gender/age가 gender_public/age_public 토글을 무시하고 전체 공개,
--   telegram_chat_id도 전체 공개. 앱 화면은 토글을 존중하지만 API로 직접 읽힌다.
--
-- 방침:
--   · 남의 프로필은 profiles_public 뷰로만 본다(안전 컬럼 + gender/age는 _public일 때만).
--   · 본인 비공개 필드는 get_my_private_profile() RPC로.
--   · 관리자는 admin_list_users()/admin_get_user() RPC로 전체 조회.
--   · 임베드(profiles!fkey(nickname,avatar_url,district))는 이 컬럼들을 안 쓰므로 영향 없음.

-- ── 1) 공개 프로필 뷰 (남이 보는 것) ─────────────────────────
-- SECURITY DEFINER 뷰(기본, security_invoker 아님) → postgres 권한으로 base를 읽어
-- REVOKE 후에도 안전 컬럼을 제공. gender/age는 _public일 때만 값이 나간다.
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
SELECT
  id, nickname, avatar_url, bio,
  pixel_avatar, reading_book, reading_book_id,
  country, district, region, school,
  gender_public, age_public,
  CASE WHEN gender_public THEN gender END AS gender,
  CASE WHEN age_public    THEN age    END AS age,
  created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- ── 2) 본인 비공개 필드 조회 ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_private_profile()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'gender', gender,
    'age', age,
    'gender_public', gender_public,
    'age_public', age_public,
    'telegram_opt_in', telegram_opt_in,
    'telegram_linked', telegram_chat_id IS NOT NULL
  ) INTO r
  FROM public.profiles WHERE id = auth.uid();
  RETURN r;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_private_profile() TO authenticated;

-- ── 3) 텔레그램 연동 여부(가벼운 불리언) ──────────────────────
CREATE OR REPLACE FUNCTION public.am_i_telegram_linked()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT telegram_chat_id IS NOT NULL FROM public.profiles WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.am_i_telegram_linked() TO authenticated;

-- ── 4) 관리자 전체 조회(비공개 필드 포함) ─────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles ORDER BY created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_user(p_user_id uuid)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_user(uuid) TO authenticated;
