create table if not exists public.saved_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique(user_id, team_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 700),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 400),
  created_at timestamptz not null default now()
);

create table if not exists public.post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.saved_teams enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_shares enable row level security;

create policy "Users can read saved teams" on public.saved_teams
  for select using (auth.uid() = user_id);
create policy "Users can save teams" on public.saved_teams
  for insert with check (auth.uid() = user_id);
create policy "Users can remove saved teams" on public.saved_teams
  for delete using (auth.uid() = user_id);

create policy "Authenticated users can read posts" on public.posts
  for select using (auth.role() = 'authenticated');
create policy "Users can create posts" on public.posts
  for insert with check (auth.uid() = user_id);
create policy "Users can update own posts" on public.posts
  for update using (auth.uid() = user_id);
create policy "Users can delete own posts" on public.posts
  for delete using (auth.uid() = user_id);

create policy "Authenticated users can read post likes" on public.post_likes
  for select using (auth.role() = 'authenticated');
create policy "Users can like posts" on public.post_likes
  for insert with check (auth.uid() = user_id);
create policy "Users can unlike posts" on public.post_likes
  for delete using (auth.uid() = user_id);

create policy "Authenticated users can read comments" on public.post_comments
  for select using (auth.role() = 'authenticated');
create policy "Users can comment" on public.post_comments
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own comments" on public.post_comments
  for delete using (auth.uid() = user_id);

create policy "Authenticated users can read shares" on public.post_shares
  for select using (auth.role() = 'authenticated');
create policy "Users can share posts" on public.post_shares
  for insert with check (auth.uid() = user_id);
