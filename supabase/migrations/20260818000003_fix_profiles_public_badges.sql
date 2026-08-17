-- 회귀 수정 · profiles_public 뷰에서 featured_badge · badges_public 가 사라진 것
--
-- 무슨 일이 있었나:
--   20260802000008_badges.sql 이 뷰에 featured_badge · badges_public 를 더했다.
--   그 뒤 20260811000001_profiles_mrt_station.sql 이 mrt_station 하나를 넣으려고
--   DROP VIEW → CREATE VIEW 를 했는데, 컬럼 목록을 **그 이전 버전 기준으로 다시 적어서**
--   배지 두 컬럼이 조용히 빠졌다.
--
--   뷰는 컬럼이 없어도 만들어지고, 깨지는 건 그 컬럼을 select 하는 화면뿐이다.
--   그래서 마이그레이션은 성공하고 빌드도 통과한 채로, 남의 프로필을 열면
--   "프로필을 찾을 수 없습니다"만 뜨는 상태가 됐다(42703).
--
-- ⚠️ 앞으로 profiles_public 을 고칠 때:
--   컬럼 목록을 새로 쓰지 말고 **바로 위 정의를 복사해서 한 줄만 더한다.**
--   이 뷰는 남의 프로필을 보는 유일한 통로라, 컬럼 하나가 빠지면 프로필 화면이 통째로 죽는다.
--   지금 화면에서 실제로 읽는 컬럼: id, nickname, avatar_url, bio, gender, age,
--   gender_public, age_public, school, featured_badge, badges_public (MemberProfileModal).

DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
SELECT
  id, nickname, avatar_url, bio,
  pixel_avatar, reading_book, reading_book_id,
  country, district, region, school, mrt_station,
  gender_public, age_public,
  CASE WHEN gender_public THEN gender END AS gender,
  CASE WHEN age_public    THEN age    END AS age,
  featured_badge, badges_public,
  created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;
