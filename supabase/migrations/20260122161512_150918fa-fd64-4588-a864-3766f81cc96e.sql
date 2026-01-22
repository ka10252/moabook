-- Fix the overly permissive INSERT policy for notifications
-- Only the trigger function (security definer) can insert notifications
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Create a more restrictive policy - notifications are inserted by triggers only
-- Users cannot directly insert notifications
CREATE POLICY "Triggers can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (false);

-- Note: The trigger function runs as SECURITY DEFINER so it bypasses RLS