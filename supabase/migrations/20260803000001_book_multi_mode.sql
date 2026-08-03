-- 책 거래 방식 중복 선택 — 한 책을 대여+판매+나눔 동시에 내놓을 수 있게.
--
-- 기존: books.mode(단일 enum rent/sell/give). 중복 불가.
-- 변경: allow_rent / allow_sell / allow_give 불리언 3개 추가.
--   · mode는 '호환용 대표 모드'로 당분간 유지(기존 코드가 아직 mode를 읽음).
--   · 코드가 3불리언을 쓰도록 바꾼 뒤, mode는 나중에 제거 검토.
--
-- ⚠️ 이 마이그만으로는 UI가 안 바뀐다. 등록폼(3중 선택)·책상세(모드별 CTA)·필터·거래 타입 코드 수정이 뒤따라야 함.

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS allow_rent boolean NOT NULL DEFAULT false;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS allow_sell boolean NOT NULL DEFAULT false;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS allow_give boolean NOT NULL DEFAULT false;

-- 기존 mode 값에서 백필(한 개만 true)
UPDATE public.books SET
  allow_rent = (mode = 'rent'),
  allow_sell = (mode = 'sell'),
  allow_give = (mode = 'give')
WHERE allow_rent = false AND allow_sell = false AND allow_give = false;

-- 최소 하나는 켜져 있어야 한다(다 꺼진 책 방지). 기존 데이터 백필 후 적용.
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_at_least_one_mode;
ALTER TABLE public.books ADD CONSTRAINT books_at_least_one_mode
  CHECK (allow_rent OR allow_sell OR allow_give);

-- 필터 성능(모드별 조회)
CREATE INDEX IF NOT EXISTS books_allow_rent_idx ON public.books (allow_rent) WHERE allow_rent;
CREATE INDEX IF NOT EXISTS books_allow_sell_idx ON public.books (allow_sell) WHERE allow_sell;
CREATE INDEX IF NOT EXISTS books_allow_give_idx ON public.books (allow_give) WHERE allow_give;

-- 참고: 새 책 INSERT 시 mode(대표)도 함께 넣어야 기존 코드가 안 깨진다.
--   대표 mode 권장 규칙: 판매 있으면 'sell', 아니면 대여 있으면 'rent', 아니면 'give'.
--   (앱 코드에서 3불리언 세팅 시 mode도 이 규칙으로 함께 세팅)
