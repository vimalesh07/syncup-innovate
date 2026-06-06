create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create index if not exists connection_requests_sender_id_idx on public.connection_requests(sender_id);
create index if not exists connection_requests_receiver_id_idx on public.connection_requests(receiver_id);
create index if not exists connection_requests_status_idx on public.connection_requests(status);

create unique index if not exists connection_requests_pending_unique_idx
  on public.connection_requests(sender_id, receiver_id)
  where status = 'pending';

alter table public.connection_requests enable row level security;

grant select, insert, update, delete on public.connection_requests to authenticated;
grant all on public.connection_requests to service_role;

drop policy if exists "Users can read their connection requests" on public.connection_requests;
create policy "Users can read their connection requests"
  on public.connection_requests for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send connection requests" on public.connection_requests;
create policy "Users can send connection requests"
  on public.connection_requests for insert
  to authenticated
  with check (auth.uid() = sender_id and sender_id <> receiver_id and status = 'pending');

drop policy if exists "Users can update their connection requests" on public.connection_requests;
create policy "Users can update their connection requests"
  on public.connection_requests for update
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id)
  with check (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can delete their connection requests" on public.connection_requests;
create policy "Users can delete their connection requests"
  on public.connection_requests for delete
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can accept connection follows" on public.user_follows;
create policy "Users can accept connection follows"
  on public.user_follows for insert
  to authenticated
  with check (
    auth.uid() = following_id
    and follower_id <> following_id
    and exists (
      select 1
      from public.connection_requests request
      where request.sender_id = follower_id
        and request.receiver_id = following_id
        and request.status in ('pending', 'accepted')
    )
  );

notify pgrst, 'reload schema';
