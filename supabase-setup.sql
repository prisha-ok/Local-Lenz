-- ════════════════════════════════════════════════════════════════
-- LOCAL LENZ — Supabase Database Setup
-- Run this entire script once in your Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → Paste → Run
-- ════════════════════════════════════════════════════════════════

-- ── 1. User Profiles ────────────────────────────────────────────
-- Mirrors auth.users, stores display name and phone.
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '',
  phone      TEXT,
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

CREATE INDEX IF NOT EXISTS idx_saved_journeys_user
  ON public.saved_journeys(user_id, saved_at DESC);

-- ── 3. Favourites ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.favourites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id    TEXT NOT NULL,
  place_name  TEXT NOT NULL,
  category    TEXT,
  description TEXT,
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_favourites_user
  ON public.favourites(user_id);

-- ── 4. Emergency Contacts ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  relationship TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user
  ON public.emergency_contacts(user_id);

-- ── 5. Search History ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.search_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin      TEXT NOT NULL,
  destination TEXT NOT NULL,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_history_user
  ON public.search_history(user_id, searched_at DESC);

-- ── 6. Emergency Contacts Registry (Global safety data) ─────────
CREATE TABLE IF NOT EXISTS public.emergency_contacts_registry (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service       TEXT NOT NULL,
  number        TEXT NOT NULL,
  region        TEXT NOT NULL DEFAULT 'All India',
  description   TEXT,
  source        TEXT,
  last_verified DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Seed global emergency contacts registry
INSERT INTO public.emergency_contacts_registry (service, number, region, description, source, last_verified)
VALUES
  ('National Emergency', '112', 'All India', 'Single emergency helpline for Police, Fire, and Health.', 'Government of India', '2026-08-01'),
  ('Police', '100', 'All India', 'Immediate law enforcement assistance.', 'Police Portal', '2026-08-01'),
  ('Ambulance / Health', '108', 'All India', 'Emergency medical response and transport.', 'Ministry of Health', '2026-08-01'),
  ('Fire Brigade', '101', 'All India', 'Fire hazard reporting.', 'National Fire Services', '2026-08-01'),
  ('Women Helpline', '1091', 'All India', 'Dedicated distress support for women.', 'Ministry of Women', '2026-08-01'),
  ('Disaster Management', '1078', 'All India', 'National disaster management control.', 'NDMA India', '2026-08-01')
ON CONFLICT DO NOTHING;

-- ── 7. Row Level Security (RLS) ──────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

-- Allow read-only access to global safety registry
ALTER TABLE public.emergency_contacts_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_read_global_registry" ON public.emergency_contacts_registry;
CREATE POLICY "allow_read_global_registry" ON public.emergency_contacts_registry
  FOR SELECT USING (true);

-- Profiles policies
DROP POLICY IF EXISTS "profiles: own row" ON public.profiles;
CREATE POLICY "profiles: own row" ON public.profiles 
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Saved journeys policies
DROP POLICY IF EXISTS "journeys: own rows" ON public.saved_journeys;
CREATE POLICY "journeys: own rows" ON public.saved_journeys 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Favourites policies
DROP POLICY IF EXISTS "favourites: own rows" ON public.favourites;
CREATE POLICY "favourites: own rows" ON public.favourites 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Emergency Contacts policies
DROP POLICY IF EXISTS "contacts: own rows" ON public.emergency_contacts;
CREATE POLICY "contacts: own rows" ON public.emergency_contacts 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Search History policies
DROP POLICY IF EXISTS "search_history: own rows" ON public.search_history;
CREATE POLICY "search_history: own rows" ON public.search_history 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 8. Profile Auto-creation Trigger ─────────────────────────────
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
