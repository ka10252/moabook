-- Create a public view that excludes pin_hash
CREATE VIEW public.communities_public
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  description,
  cover_url,
  created_by,
  member_count,
  created_at
FROM public.communities;

-- Drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Communities are viewable by everyone" ON public.communities;

-- Create a new policy that only allows creators to see their own communities directly
-- (for pin verification during join)
CREATE POLICY "Community creators can view their communities"
ON public.communities
FOR SELECT
USING (auth.uid() = created_by);

-- Members can also view communities they belong to (for internal operations)
CREATE POLICY "Community members can view their communities"
ON public.communities
FOR SELECT
USING (is_community_member(auth.uid(), id));