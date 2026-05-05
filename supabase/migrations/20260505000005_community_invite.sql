-- Community invite token (generated on demand by owner)
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;

-- SECURITY DEFINER function: join a community via invite token
-- Returns jsonb: { success, community_id, community_name, already_member, error }
CREATE OR REPLACE FUNCTION public.join_via_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community_id UUID;
  v_community_name TEXT;
BEGIN
  SELECT id, name INTO v_community_id, v_community_name
  FROM public.communities
  WHERE invite_token = p_token;

  IF v_community_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  -- Already banned?
  IF EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = v_community_id AND user_id = auth.uid() AND is_banned = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'banned');
  END IF;

  -- Already a member?
  IF EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = v_community_id AND user_id = auth.uid() AND is_banned = false
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'community_id', v_community_id,
      'community_name', v_community_name,
      'already_member', true
    );
  END IF;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (v_community_id, auth.uid(), 'member');

  RETURN jsonb_build_object(
    'success', true,
    'community_id', v_community_id,
    'community_name', v_community_name,
    'already_member', false
  );
END;
$$;

-- Allow owner to update invite_token on their own community
CREATE POLICY "Owner can manage invite token"
  ON public.communities FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
