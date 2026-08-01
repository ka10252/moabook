-- 20260801000004의 REVOKE SELECT (telegram_link_code) 는 무효였다.
-- Postgres: 테이블 레벨 SELECT 권한이 있으면 컬럼 단위 REVOKE는 효과가 없다(모든 컬럼 읽힘).
-- 실제로 telegram_link_code가 계속 노출됨을 확인.
--
-- 올바른 방법: 테이블 SELECT를 회수한 뒤, '허용 컬럼만' 다시 GRANT 한다.
--   → telegram_link_code(연동 비밀코드)만 빠져 anon/authenticated가 읽을 수 없게 된다.
--   → 이 컬럼은 클라가 UPDATE(쓰기)만 하므로 GRANT(SELECT)에서 빠져도 앱 동작 영향 없음.
--   → 봇(Edge Function)은 service_role이라 영향 없음.
--
-- ⚠️ 실행 순서: 이 마이그레이션 후 profiles를 select('*') 하면 권한오류가 난다.
--    명시 컬럼으로 바꾼 새 코드가 '배포되어 반영된 뒤' 실행할 것.

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, nickname, avatar_url, bio,
  gender, age, gender_public, age_public,
  country, district, region,
  pixel_avatar, reading_book, reading_book_id,
  telegram_chat_id, telegram_opt_in,
  created_at, updated_at
) ON public.profiles TO anon, authenticated;
