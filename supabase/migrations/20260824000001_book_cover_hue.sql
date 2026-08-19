-- 표지에서 뽑은 색상(hue)
--
-- 책등 색을 표지에서 가져온다. 다만 **색상(H)만** 쓴다 — 채도·명도까지 그대로 쓰면
-- 탁한 표지는 탁한 책등이 되어 지금과 똑같아진다. 채도·명도는 앱이 정한 사다리에 맞춘다.
--
-- 값은 0~359. NULL 이면 추출에 실패했거나 아직 안 해본 책이다
-- (표지가 없거나, 흑백·무채색이라 고를 색이 없는 경우) → 앱이 기본 팔레트로 떨어뜨린다.
--
-- 왜 저장하나: 표지 이미지를 매번 내려받아 캔버스로 재면 서가가 뜰 때마다 20장을
-- 다시 읽어야 한다. 등록할 때 한 번 재서 넣어둔다.

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS cover_hue smallint;

ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_cover_hue_check;
ALTER TABLE public.books
  ADD CONSTRAINT books_cover_hue_check CHECK (cover_hue IS NULL OR (cover_hue >= 0 AND cover_hue <= 359));

COMMENT ON COLUMN public.books.cover_hue IS
  '표지에서 뽑은 색상 0~359. 책등 색의 색상만 여기서 오고 채도·명도는 앱이 정한다. NULL=추출 실패';
