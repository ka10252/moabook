-- 1. Create enum for member visibility type
CREATE TYPE public.member_visibility AS ENUM ('public', 'members_only', 'private');

-- 2. Add member_visibility column to communities table
ALTER TABLE public.communities 
ADD COLUMN member_visibility public.member_visibility NOT NULL DEFAULT 'members_only';

-- 3. Add kick_count and is_banned columns to community_members table
ALTER TABLE public.community_members 
ADD COLUMN kick_count integer NOT NULL DEFAULT 0,
ADD COLUMN is_banned boolean NOT NULL DEFAULT false;

-- 4. Add unique constraint on profiles.nickname (case-insensitive)
CREATE UNIQUE INDEX profiles_nickname_unique ON public.profiles (LOWER(nickname));

-- 5. Create function to check if user is banned from community
CREATE OR REPLACE FUNCTION public.is_banned_from_community(_user_id uuid, _community_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_members
    WHERE user_id = _user_id
      AND community_id = _community_id
      AND is_banned = true
  )
$$;

-- 6. Update RLS policy for community_members to prevent banned users from joining
DROP POLICY IF EXISTS "Users can join communities" ON public.community_members;

CREATE POLICY "Users can join communities"
ON public.community_members
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND NOT is_banned_from_community(auth.uid(), community_id)
);

-- 7. Create policy for viewing community members based on visibility
-- First, create a function to check member visibility
CREATE OR REPLACE FUNCTION public.can_view_community_members(_community_id uuid, _viewer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  visibility public.member_visibility;
  is_creator boolean;
  is_member boolean;
BEGIN
  -- Get community visibility and check if viewer is creator
  SELECT c.member_visibility, c.created_by = _viewer_id
  INTO visibility, is_creator
  FROM public.communities c
  WHERE c.id = _community_id;
  
  -- Private: only creator can view
  IF visibility = 'private' THEN
    RETURN is_creator;
  END IF;
  
  -- Members only: creator or members can view
  IF visibility = 'members_only' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.community_members
      WHERE community_id = _community_id AND user_id = _viewer_id
    ) INTO is_member;
    RETURN is_creator OR is_member;
  END IF;
  
  -- Public: everyone can view
  RETURN true;
END;
$$;