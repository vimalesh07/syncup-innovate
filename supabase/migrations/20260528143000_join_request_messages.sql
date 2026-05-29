CREATE TABLE IF NOT EXISTS public.join_request_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.join_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.join_request_messages TO authenticated;
GRANT ALL ON public.join_request_messages TO service_role;
ALTER TABLE public.join_request_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Request participants read messages" ON public.join_request_messages
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.join_requests jr
        JOIN public.teams t ON t.id = jr.team_id
        WHERE jr.id = request_id
          AND (jr.user_id = auth.uid() OR t.leader_id = auth.uid())
      )
    );

  CREATE POLICY "Request participants send messages" ON public.join_request_messages
    FOR INSERT TO authenticated
    WITH CHECK (
      sender_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.join_requests jr
        JOIN public.teams t ON t.id = jr.team_id
        WHERE jr.id = request_id
          AND (jr.user_id = auth.uid() OR t.leader_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.join_request_messages;
