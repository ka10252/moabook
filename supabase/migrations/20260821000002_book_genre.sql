-- 책 장르 (필터용)
--
-- 값은 앱의 `src/lib/genre.ts` 의 GENRES 와 같은 문자열을 쓴다.
-- enum 타입으로 굳히지 않은 이유: 장르는 앞으로 몇 번 더 손볼 값이라
-- 그때마다 타입 마이그레이션을 도는 것보다 문자열 + 앱 쪽 검사가 가볍다.
-- 모르는 값이 들어와도 앱은 '기타'로 취급하므로 화면이 깨지지 않는다.

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS genre text;

COMMENT ON COLUMN public.books.genre IS '장르 — src/lib/genre.ts 의 GENRES 값. NULL 이면 미분류(기타로 표시)';

-- 필터가 장르로 추리므로 인덱스를 둔다. 지금은 책이 적어 의미가 없지만
-- 나중에 넣으려면 트래픽이 있는 시점에 잠깐 잠그게 된다.
CREATE INDEX IF NOT EXISTS books_genre_idx ON public.books (genre);
