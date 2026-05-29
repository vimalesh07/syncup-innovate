ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS team_purpose TEXT DEFAULT 'Competition',
  ADD COLUMN IF NOT EXISTS target_name TEXT,
  ADD COLUMN IF NOT EXISTS target_url TEXT;
