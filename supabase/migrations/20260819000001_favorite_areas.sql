-- F19 · 즐겨찾기 지역
--
-- 서가에는 이미 역·지역 필터가 있는데, 앱을 껐다 켜면 초기화된다.
-- 매번 다시 고르는 게 일이라 자주 보는 곳을 프로필에 저장해두고 한 번에 적용한다.
--
-- profiles.mrt_station(내 집 근처 역)과는 다른 값이다.
--   mrt_station = 내 책이 있는 곳(남에게 공개된다)
--   favorite_*  = 내가 보고 싶은 곳(나만 본다)
-- 그래서 profiles_public 뷰에는 넣지 않는다.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_stations  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favorite_districts text[] NOT NULL DEFAULT '{}';

-- profiles는 컬럼 단위로 권한을 준다. 여기 빠뜨리면 select/update가 조용히 막힌다.
GRANT SELECT (favorite_stations, favorite_districts) ON public.profiles TO authenticated;
GRANT UPDATE (favorite_stations, favorite_districts) ON public.profiles TO authenticated;
