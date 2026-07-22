-- 긴 제목이 책등에서 어떻게 잘리는지(말줄임) 실제 책장에서 확인하기 위한 표본 한 권.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
--
-- ⚠️ 아래 이메일을 본인 계정 이메일로 바꾼 뒤 실행할 것.
--    (앱에서는 로그인한 본인 명의로만 책을 넣을 수 있어, 코드로는 대신 넣어드릴 수 없습니다.)

insert into public.books (title, author, condition, mode, status, is_public, owner_id)
select
  '아주 긴 제목의 책은 책등에서 어떻게 보이는가에 관한 연구',
  '김서연',
  'A',
  'rent',
  'available',
  true,
  u.id
from auth.users u
where u.email = 'leeyjin212@gmail.com';   -- ← 본인 이메일로 교체

-- 확인 후 지우고 싶으면:
-- delete from public.books where title like '아주 긴 제목의 책은%';
