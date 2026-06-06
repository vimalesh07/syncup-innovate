alter table public.direct_messages
  add column if not exists reactions jsonb not null default '{}'::jsonb;

alter table public.join_request_messages
  add column if not exists reactions jsonb not null default '{}'::jsonb;

alter table public.team_messages
  add column if not exists reactions jsonb not null default '{}'::jsonb;

grant update on public.direct_messages to authenticated;
grant update on public.join_request_messages to authenticated;
grant update on public.team_messages to authenticated;

do $$ begin
  create policy "Direct message participants update reactions"
    on public.direct_messages for update
    to authenticated
    using (auth.uid() = sender_id or auth.uid() = recipient_id)
    with check (auth.uid() = sender_id or auth.uid() = recipient_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Request message participants update reactions"
    on public.join_request_messages for update
    to authenticated
    using (
      exists (
        select 1
        from public.join_requests jr
        join public.teams t on t.id = jr.team_id
        where jr.id = request_id
          and (jr.user_id = auth.uid() or t.leader_id = auth.uid())
      )
    )
    with check (
      exists (
        select 1
        from public.join_requests jr
        join public.teams t on t.id = jr.team_id
        where jr.id = request_id
          and (jr.user_id = auth.uid() or t.leader_id = auth.uid())
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Team message participants update reactions"
    on public.team_messages for update
    to authenticated
    using (
      exists (
        select 1
        from public.teams t
        left join public.team_members tm on tm.team_id = t.id and tm.user_id = auth.uid()
        where t.id = team_messages.team_id
          and (t.leader_id = auth.uid() or tm.user_id = auth.uid())
      )
    )
    with check (
      exists (
        select 1
        from public.teams t
        left join public.team_members tm on tm.team_id = t.id and tm.user_id = auth.uid()
        where t.id = team_messages.team_id
          and (t.leader_id = auth.uid() or tm.user_id = auth.uid())
      )
    );
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
