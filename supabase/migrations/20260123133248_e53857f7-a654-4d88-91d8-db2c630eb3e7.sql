-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for community covers
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-covers', 'community-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for community covers
CREATE POLICY "Community cover images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-covers');

CREATE POLICY "Authenticated users can upload community covers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'community-covers' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update community covers"
ON storage.objects FOR UPDATE
USING (bucket_id = 'community-covers' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete community covers"
ON storage.objects FOR DELETE
USING (bucket_id = 'community-covers' AND auth.uid() IS NOT NULL);