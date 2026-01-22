-- Create liked_books table for storing user's interested books
CREATE TABLE public.liked_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, book_id)
);

-- Enable Row Level Security
ALTER TABLE public.liked_books ENABLE ROW LEVEL SECURITY;

-- Users can view their own liked books
CREATE POLICY "Users can view their liked books" 
ON public.liked_books 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can like books
CREATE POLICY "Users can like books" 
ON public.liked_books 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can unlike books
CREATE POLICY "Users can unlike books" 
ON public.liked_books 
FOR DELETE 
USING (auth.uid() = user_id);