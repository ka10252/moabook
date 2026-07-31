-- 지금 읽는 책: 우리 books 테이블에 없는 책(검색으로 찾은 임의의 책)도 지정할 수 있게
-- 스냅샷(제목·저자·표지·소개)을 jsonb로 저장한다. 우리 책이면 id도 함께 담는다.
-- 형태: { "id": uuid|null, "title": text, "author": text|null, "coverUrl": text|null, "description": text|null }
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reading_book jsonb;
