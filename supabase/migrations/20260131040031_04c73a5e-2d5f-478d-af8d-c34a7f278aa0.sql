-- Add return_date column to transactions table
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS return_date timestamp with time zone DEFAULT NULL;

-- Create book-covers storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('book-covers', 'book-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for book-covers bucket
CREATE POLICY "Book covers are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-covers');

CREATE POLICY "Authenticated users can upload book covers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'book-covers' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own book covers"
ON storage.objects FOR UPDATE
USING (bucket_id = 'book-covers' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own book covers"
ON storage.objects FOR DELETE
USING (bucket_id = 'book-covers' AND auth.role() = 'authenticated');