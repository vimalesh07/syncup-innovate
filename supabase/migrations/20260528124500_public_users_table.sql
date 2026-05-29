CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  auth_provider TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own account mirror" ON public.users
    FOR SELECT TO authenticated USING (auth.uid() = id);
  CREATE POLICY "Users update own account mirror" ON public.users
    FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url, auth_provider, last_seen_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    auth_provider = COALESCE(EXCLUDED.auth_provider, public.users.auth_provider),
    last_seen_at = now(),
    updated_at = now();

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
