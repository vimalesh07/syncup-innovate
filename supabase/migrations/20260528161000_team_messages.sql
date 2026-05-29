create table if not exists public.team_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.team_messages enable row level security;

create policy "Team members can read team messages" on public.team_messages
  for select using (
    exists (
      select 1
      from public.teams t
      left join public.team_members tm on tm.team_id = t.id and tm.user_id = auth.uid()
      where t.id = team_messages.team_id
        and (t.leader_id = auth.uid() or tm.user_id = auth.uid())
    )
  );

create policy "Team members can send team messages" on public.team_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.teams t
      left join public.team_members tm on tm.team_id = t.id and tm.user_id = auth.uid()
      where t.id = team_messages.team_id
        and (t.leader_id = auth.uid() or tm.user_id = auth.uid())
    )
  );

grant select, insert on public.team_messages to authenticated;
grant all on public.team_messages to service_role;

alter publication supabase_realtime add table public.team_messages;
