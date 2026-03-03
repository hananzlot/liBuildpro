
-- Add archived_at column to profiles for soft-delete (archiving) users
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add archived_by to track who archived the user
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_by UUID DEFAULT NULL;

-- Index for quickly filtering archived vs active users
CREATE INDEX IF NOT EXISTS idx_profiles_archived_at ON public.profiles (archived_at) WHERE archived_at IS NOT NULL;
