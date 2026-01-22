-- Create notifications table for community events
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- System can create notifications (via trigger/function)
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- Add policy for community admin to delete members
CREATE POLICY "Community admin can delete members"
ON public.community_members FOR DELETE
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.communities 
    WHERE id = community_id AND created_by = auth.uid()
  )
);

-- Add policy for community admin to delete community
CREATE POLICY "Community admin can delete community"
ON public.communities FOR DELETE
USING (auth.uid() = created_by);

-- Create function to notify community owner when someone joins
CREATE OR REPLACE FUNCTION public.notify_community_owner_on_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  community_owner_id uuid;
  community_name text;
  joiner_nickname text;
BEGIN
  -- Get community owner and name
  SELECT created_by, name INTO community_owner_id, community_name
  FROM public.communities
  WHERE id = NEW.community_id;

  -- Don't notify if owner is joining their own community
  IF community_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get joiner's nickname
  SELECT nickname INTO joiner_nickname
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Create notification for the community owner
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    community_owner_id,
    'community_join',
    '새 멤버 가입',
    joiner_nickname || '님이 "' || community_name || '" 커뮤니티에 가입했습니다.',
    jsonb_build_object(
      'community_id', NEW.community_id,
      'member_id', NEW.user_id
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger to notify on new member join
CREATE TRIGGER on_community_member_join
AFTER INSERT ON public.community_members
FOR EACH ROW
EXECUTE FUNCTION public.notify_community_owner_on_join();