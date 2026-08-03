-- 위시리스트 항목에 책 표지 저장(검색으로 고른 책의 표지 URL). 수동 입력은 null(색 플레이스홀더).
ALTER TABLE public.wishlists ADD COLUMN IF NOT EXISTS cover_url text;
