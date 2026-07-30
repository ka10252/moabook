-- moabook 더미데이터 정리 스크립트 (출시 전 1회 실행)
-- 실행 위치: Supabase 대시보드 → SQL Editor (service_role 권한 필요)
--
-- 남기는 계정(keep-list): 관리자, 들레, dlee
-- 지우는 것: 나머지 모든 프로필(데모계정·김독서·이책방·박문고·User_xxxx)
--            + 강남 북클럽 커뮤니티 + 그들이 소유한 책/거래/메시지 (CASCADE 자동)
--
-- profiles.id → auth.users ON DELETE CASCADE, 앱 테이블 대부분 → profiles ON DELETE CASCADE
-- 이므로 auth.users만 지우면 소유 데이터가 연쇄 삭제된다.

BEGIN;

-- (0) 실행 전 미리보기: 지워질 계정 목록 확인용 (원하면 이 SELECT만 먼저 돌려보세요)
--   SELECT nickname, id FROM public.profiles
--   WHERE nickname NOT IN ('관리자','들레','dlee');

-- (1) 데모 커뮤니티 삭제 (created_by가 SET NULL이라 계정 삭제로는 안 지워짐)
--     community_members / community_posts / community_comments 는 CASCADE로 함께 삭제됨
DELETE FROM public.communities
WHERE name = '강남 북클럽';

-- (2) keep-list 이외의 모든 계정을 auth.users에서 삭제
--     → profiles + 그들의 books/transactions/messages/wishlist/waitlist 등 전부 CASCADE 삭제
DELETE FROM auth.users
WHERE id IN (
  SELECT id FROM public.profiles
  WHERE nickname NOT IN ('관리자', '들레', 'dlee')
);

-- (3) 확인: 남은 프로필 / 커뮤니티 / 책 수
--   실행 후 아래로 검증
--   SELECT nickname FROM public.profiles ORDER BY nickname;
--   SELECT count(*) AS books FROM public.books;
--   SELECT count(*) AS communities FROM public.communities;

COMMIT;
