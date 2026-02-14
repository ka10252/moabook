-- Allow all authenticated users to discover communities (needed for communities_public view)
CREATE POLICY "All authenticated users can view communities"
  ON public.communities
  FOR SELECT
  USING (auth.uid() IS NOT NULL);