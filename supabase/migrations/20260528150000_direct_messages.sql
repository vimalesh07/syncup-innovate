CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users read own direct messages" ON public.direct_messages
    FOR SELECT TO authenticated
    USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

  CREATE POLICY "Users send direct messages" ON public.direct_messages
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = sender_id);

  CREATE POLICY "Recipients mark direct messages read" ON public.direct_messages
    FOR UPDATE TO authenticated
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
