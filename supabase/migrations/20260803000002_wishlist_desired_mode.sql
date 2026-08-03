-- 위시리스트 항목에 '대여 원함/구입 원함/상관없음' 표시.
--   rent = 빌리고 싶음, buy = 사고 싶음, any = 상관없음(기본)
ALTER TABLE public.wishlists ADD COLUMN IF NOT EXISTS desired_mode text NOT NULL DEFAULT 'any';
ALTER TABLE public.wishlists DROP CONSTRAINT IF EXISTS wishlists_desired_mode_chk;
ALTER TABLE public.wishlists ADD CONSTRAINT wishlists_desired_mode_chk
  CHECK (desired_mode IN ('rent', 'buy', 'any'));
