-- Migration: Create profiles table
-- Requirements: 1.4 (auto-create profile on user creation)

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by auth user id
CREATE INDEX idx_profiles_auth_user_id ON profiles(auth_user_id);

COMMENT ON TABLE profiles IS 'User profiles linked to Supabase auth.users';
COMMENT ON COLUMN profiles.auth_user_id IS 'References the Supabase auth.users id';
