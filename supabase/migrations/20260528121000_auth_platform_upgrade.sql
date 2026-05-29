ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Developer',
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.profile_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  team_invites BOOLEAN NOT NULL DEFAULT true,
  public_profile BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_settings TO authenticated;
GRANT ALL ON public.profile_settings TO service_role;
ALTER TABLE public.profile_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own settings" ON public.profile_settings
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.saved_competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE,
  title TEXT,
  organizer TEXT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, competition_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_competitions TO authenticated;
GRANT ALL ON public.saved_competitions TO service_role;
ALTER TABLE public.saved_competitions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own saved competitions" ON public.saved_competitions
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.activity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_history TO authenticated;
GRANT ALL ON public.activity_history TO service_role;
ALTER TABLE public.activity_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own activity" ON public.activity_history
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
  CREATE POLICY "Users create own activity" ON public.activity_history
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    avatar_url,
    username,
    college,
    skills,
    role,
    github_url,
    linkedin_url,
    portfolio_url
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 4)),
    NEW.raw_user_meta_data->>'college',
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'skills')),
      '{}'
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Developer'),
    NEW.raw_user_meta_data->>'github_url',
    NEW.raw_user_meta_data->>'linkedin_url',
    NEW.raw_user_meta_data->>'portfolio_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    college = COALESCE(EXCLUDED.college, public.profiles.college),
    skills = COALESCE(EXCLUDED.skills, public.profiles.skills),
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    github_url = COALESCE(EXCLUDED.github_url, public.profiles.github_url),
    linkedin_url = COALESCE(EXCLUDED.linkedin_url, public.profiles.linkedin_url),
    portfolio_url = COALESCE(EXCLUDED.portfolio_url, public.profiles.portfolio_url);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  INSERT INTO public.profile_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.activity_history (user_id, action, details)
  VALUES (NEW.id, 'account_created', 'Joined SyncUp') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
