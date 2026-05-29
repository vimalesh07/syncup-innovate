grant update on public.direct_messages to authenticated;
grant update on public.join_request_messages to authenticated;
grant update on public.team_messages to authenticated;

do $$ begin
  create policy "Direct message participants update message metadata"
    on public.direct_messages for update
    to authenticated
    using (auth.uid() = sender_id or auth.uid() = recipient_id)
    with check (auth.uid() = sender_id or auth.uid() = recipient_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Request participants update message metadata"
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
