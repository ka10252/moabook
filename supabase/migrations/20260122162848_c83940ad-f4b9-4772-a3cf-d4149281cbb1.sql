-- Add UPDATE policy for community owners to edit their communities
CREATE POLICY "Community admin can update community"
ON public.communities
FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);