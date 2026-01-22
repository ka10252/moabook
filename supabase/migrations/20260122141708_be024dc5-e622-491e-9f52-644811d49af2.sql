-- Add description and cover_url columns to communities table
ALTER TABLE public.communities 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Add gender, age, bio, and privacy settings to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS gender_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS age_public BOOLEAN DEFAULT false;