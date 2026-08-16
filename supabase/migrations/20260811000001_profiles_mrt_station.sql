-- 책 위치 기준을 "거주 지역"에서 "집에서 가까운 MRT역"으로 바꾼다.
--
-- 왜: 지역(planning area)은 몇 km짜리라 지도에서 거리 감각이 안 나오고,
--     정확한 주소는 남의 집 위치를 공개하는 것이라 쓸 수 없다.
--     역은 그 중간이다 — 공공장소이고, 실제로 만나서 주고받는 지점이기도 하다.
--
-- district는 그대로 둔다. 역이 어느 지역에 속하는지는 프론트(src/data/mrtStations.ts)가 알고 있어서
-- 가입 시 역을 고르면 district도 함께 채워 넣는다. 기존 지역 필터가 그대로 동작한다.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mrt_station text;

-- profiles는 컬럼 단위 GRANT를 쓴다(20260801000005). 새 컬럼은 명시적으로 열어줘야 읽힌다.
GRANT SELECT (mrt_station) ON public.profiles TO anon, authenticated;

-- 공개 뷰에도 노출. 역은 공개해도 되는 정보다(집 주소가 아니라 공공장소).
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
SELECT
  id, nickname, avatar_url, bio,
  pixel_avatar, reading_book, reading_book_id,
  country, district, region, school, mrt_station,
  gender_public, age_public,
  CASE WHEN gender_public THEN gender END AS gender,
  CASE WHEN age_public    THEN age    END AS age,
  created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 가입 시점엔 이메일 인증 때문에 세션이 없어서 클라이언트 UPDATE가 RLS에 막힌다.
-- country·region과 같은 방식으로 메타데이터에 실어 보내고 트리거가 프로필에 넣는다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, country, region, district, mrt_station)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'User_' || LEFT(NEW.id::text, 8)),
    NULLIF(NEW.raw_user_meta_data->>'country', ''),
    NULLIF(NEW.raw_user_meta_data->>'region', ''),
    NULLIF(NEW.raw_user_meta_data->>'district', ''),
    NULLIF(NEW.raw_user_meta_data->>'mrt_station', '')
  );
  RETURN NEW;
END;
$$;

-- 이미 가입했는데 메타데이터에만 있는 경우를 메운다(재실행 안전).
UPDATE public.profiles p
SET mrt_station = NULLIF(u.raw_user_meta_data->>'mrt_station', '')
FROM auth.users u
WHERE u.id = p.id
  AND p.mrt_station IS NULL
  AND NULLIF(u.raw_user_meta_data->>'mrt_station', '') IS NOT NULL;

UPDATE public.profiles p
SET district = NULLIF(u.raw_user_meta_data->>'district', '')
FROM auth.users u
WHERE u.id = p.id
  AND p.district IS NULL
  AND NULLIF(u.raw_user_meta_data->>'district', '') IS NOT NULL;
