GRANT INSERT ON public.notifications TO authenticated;

DO $$ BEGIN
  CREATE POLICY "Authenticated users create notifications" ON public.notifications
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
