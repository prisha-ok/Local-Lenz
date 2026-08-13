-- ════════════════════════════════════════════════════════════════
-- LOCAL LENZ — Supabase Database Setup
-- Run this entire script once in your Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → Paste → Run
-- ════════════════════════════════════════════════════════════════

-- ── 1. User Profiles ────────────────────────────────────────────
-- Mirrors auth.users, stores display name and phone.
CREATE TABLE IF NOT EXISTS public.profiles (
  id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL DEFAULT '',
  phone    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Saved Journeys ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_journeys (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_city TEXT NOT NULL,
  to_city   TEXT NOT NULL,
  stops     JSONB NOT NULL DEFAULT '[]',
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster per-user queries
CREATE INDEX IF NOT EXISTS idx_saved_journeys_user
  ON public.saved_journeys(user_id, saved_at DESC);

-- ── 3. Row Level Security (RLS) ──────────────────────────────────
-- Users can ONLY read/write their own data.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_journeys ENABLE ROW LEVEL SECURITY;

-- Profiles: full access to own row only
DROP POLICY IF EXISTS "profiles: own row" ON public.profiles;
CREATE POLICY "profiles: own row"
  ON public.profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Saved journeys: full access to own rows only
DROP POLICY IF EXISTS "journeys: own rows" ON public.saved_journeys;
CREATE POLICY "journeys: own rows"
  ON public.saved_journeys FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. Optional: Auto-create profile on signup ───────────────────
-- This trigger creates a profile row automatically when a user signs up.
-- Comment this out if you prefer to create profiles manually in auth.js.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ════════════════════════════════════════════════════════════════
-- IMPORTANT: Disable Email Confirmation for Prototype/Demo
-- Go to: Supabase Dashboard → Authentication → Settings
-- Turn OFF "Enable email confirmations"
-- This lets users log in immediately after signing up.
-- Re-enable before going to production.
-- ════════════════════════════════════════════════════════════════
