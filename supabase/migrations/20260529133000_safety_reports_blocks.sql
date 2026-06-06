create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique(post_id, reporter_id)
);

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.post_reports enable row level security;
alter table public.user_blocks enable row level security;

create index if not exists post_reports_post_id_idx on public.post_reports(post_id);
create index if not exists post_reports_reporter_id_idx on public.post_reports(reporter_id);
create index if not exists user_blocks_blocker_id_idx on public.user_blocks(blocker_id);
create index if not exists user_blocks_blocked_id_idx on public.user_blocks(blocked_id);

grant select, insert, update on public.post_reports to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant all on public.post_reports to service_role;
grant all on public.user_blocks to service_role;

drop policy if exists "Users create own reports" on public.post_reports;
create policy "Users create own reports" on public.post_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "Users read own reports" on public.post_reports;
create policy "Users read own reports" on public.post_reports
  for select to authenticated
  using (auth.uid() = reporter_id or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins update reports" on public.post_reports;
create policy "Admins update reports" on public.post_reports
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users read own blocks" on public.user_blocks;
create policy "Users read own blocks" on public.user_blocks
  for select to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "Users block profiles" on public.user_blocks;
create policy "Users block profiles" on public.user_blocks
  for insert to authenticated
  with check (auth.uid() = blocker_id);

drop policy if exists "Users unblock profiles" on public.user_blocks;
create policy "Users unblock profiles" on public.user_blocks
  for delete to authenticated
  using (auth.uid() = blocker_id);
