alter table public.direct_messages
  add column if not exists deleted_for uuid[] not null default '{}',
  add column if not exists deleted_for_everyone boolean not null default false;

alter table public.join_request_messages
  add column if not exists deleted_for uuid[] not null default '{}',
  add column if not exists deleted_for_everyone boolean not null default false;

alter table public.team_messages
  add column if not exists deleted_for uuid[] not null default '{}',
  add column if not exists deleted_for_everyone boolean not null default false;

create policy "Direct message participants can delete visibility" on public.direct_messages
  for update to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id)
  with check (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Request message participants can delete visibility" on public.join_request_messages
  for update to authenticated
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

create policy "Team message members can delete visibility" on public.team_messages
  for update to authenticated
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

create policy "Team leaders can remove members" on public.team_members
  for delete to authenticated
  using (
    exists (
      select 1
      from public.teams t
      where t.id = team_members.team_id
        and t.leader_id = auth.uid()
        and team_members.user_id <> auth.uid()
    )
  );
