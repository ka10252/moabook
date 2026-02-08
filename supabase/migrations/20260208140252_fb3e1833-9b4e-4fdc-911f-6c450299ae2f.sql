-- Create site_announcements table for global admin messages
CREATE TABLE public.site_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_message TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;

-- Everyone can read announcements
CREATE POLICY "Announcements are viewable by everyone"
ON public.site_announcements
FOR SELECT
USING (true);

-- Only admins can update announcements
CREATE POLICY "Admins can update announcements"
ON public.site_announcements
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Only admins can insert announcements
CREATE POLICY "Admins can insert announcements"
ON public.site_announcements
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert initial empty announcement
INSERT INTO public.site_announcements (admin_message) VALUES ('');

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_announcements;