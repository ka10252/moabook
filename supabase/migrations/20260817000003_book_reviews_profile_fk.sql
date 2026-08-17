-- 리뷰에 작성자 프로필(닉네임·아바타)을 붙이려면 FK가 profiles를 가리켜야 한다.
--
-- 20260817000001에서 user_id를 auth.users(id)로 걸었는데, PostgREST는 그 관계로
-- profiles를 조인하지 못한다:
--   PGRST200 — "no foreign key relationship between 'book_reviews' and 'profiles'"
-- books.owner_id가 profiles(id)를 참조하는 것과 같은 방식으로 맞춘다.
--
-- profiles.id 자체가 auth.users(id)를 참조하므로 유저가 지워지면 여기까지 연쇄 삭제된다.

ALTER TABLE public.book_reviews
  DROP CONSTRAINT IF EXISTS book_reviews_user_id_fkey;

ALTER TABLE public.book_reviews
  ADD CONSTRAINT book_reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- PostgREST가 관계를 다시 읽도록 스키마 캐시를 갱신한다.
NOTIFY pgrst, 'reload schema';
