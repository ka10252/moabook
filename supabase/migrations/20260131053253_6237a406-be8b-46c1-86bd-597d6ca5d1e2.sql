-- Fix member_count default to 0 so trigger correctly sets it to 1 when creator joins
ALTER TABLE public.communities ALTER COLUMN member_count SET DEFAULT 0;

-- Fix existing communities that have incorrect member counts
-- Update member_count to match actual number of members
UPDATE public.communities c
SET member_count = (
  SELECT COUNT(*)
  FROM public.community_members cm
  WHERE cm.community_id = c.id AND cm.is_banned = false
);