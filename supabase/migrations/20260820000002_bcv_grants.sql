-- book_community_visibility 권한 부여.
--
-- ⚠️ 앞 마이그레이션(20260820000001)에서 RLS 정책만 만들고 **테이블 GRANT를 빠뜨렸다.**
--    Postgres에서 RLS는 "행을 걸러내는" 층이고, 그 앞에 "테이블에 접근할 수 있는가"라는
--    권한 층이 따로 있다. 정책이 아무리 허용해도 GRANT가 없으면 42501로 막힌다.
--    (profiles 처럼 컬럼 GRANT를 쓰는 표가 이미 있는데도 놓쳤다)
GRANT SELECT ON public.book_community_visibility TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.book_community_visibility TO authenticated;
