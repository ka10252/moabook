-- "지금 읽는 책" — 가상공간에서 캐릭터 머리 위 말풍선으로 표시
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reading_book_id uuid REFERENCES public.books(id) ON DELETE SET NULL;
