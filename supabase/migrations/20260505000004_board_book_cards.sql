-- Add optional book reference to community posts for book reviews
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES public.books(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_community_posts_book_id ON public.community_posts (book_id);
