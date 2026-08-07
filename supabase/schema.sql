-- Supabase Initial Schema & RLS Setup Migration
-- Created at: 2026-08-03

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT,
  full_name TEXT,
  username TEXT,
  role TEXT,
  position TEXT,
  preferred_foot TEXT,
  nationality TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  team_name TEXT NOT NULL,
  division TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Fixtures Table
CREATE TABLE IF NOT EXISTS public.fixtures (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  match_date TEXT,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  division TEXT,
  venue TEXT,
  match_type TEXT,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT DEFAULT 'Upcoming',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Match Logs Table
CREATE TABLE IF NOT EXISTS public.match_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  match_id TEXT,
  team_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  goals INTEGER DEFAULT 0,
  shots INTEGER DEFAULT 0,
  shot_on_target INTEGER DEFAULT 0,
  passes INTEGER DEFAULT 0,
  completed_passes INTEGER DEFAULT 0,
  duels INTEGER DEFAULT 0,
  duels_won INTEGER DEFAULT 0,
  tackles INTEGER DEFAULT 0,
  tackles_won INTEGER DEFAULT 0,
  interceptions INTEGER DEFAULT 0,
  clearances INTEGER DEFAULT 0,
  recoveries INTEGER DEFAULT 0,
  fouls INTEGER DEFAULT 0,
  was_fouled INTEGER DEFAULT 0,
  yellow_card INTEGER DEFAULT 0,
  red_card INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  key_passes INTEGER DEFAULT 0,
  crosses INTEGER DEFAULT 0,
  completed_crosses INTEGER DEFAULT 0,
  dribbles INTEGER DEFAULT 0,
  successful_dribbles INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_logs ENABLE ROW LEVEL SECURITY;

-- PERMISSIVE PUBLIC ACCESS POLICIES (Allow client-side read/write/update/delete)
DROP POLICY IF EXISTS "Public access for profiles" ON public.profiles;
CREATE POLICY "Public access for profiles" ON public.profiles
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public insert to profiles" ON public.profiles;
CREATE POLICY "Allow public insert to profiles" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update to profiles" ON public.profiles;
CREATE POLICY "Allow public update to profiles" ON public.profiles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public access for teams" ON public.teams;
CREATE POLICY "Public access for teams" ON public.teams
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for fixtures" ON public.fixtures;
CREATE POLICY "Public access for fixtures" ON public.fixtures
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for match_logs" ON public.match_logs;
CREATE POLICY "Public access for match_logs" ON public.match_logs
  FOR ALL USING (true) WITH CHECK (true);
