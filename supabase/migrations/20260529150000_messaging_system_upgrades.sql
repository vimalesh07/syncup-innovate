alter table public.direct_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_by uuid[] not null default '{}',
  add column if not exists edited_at timestamptz,
  add column if not exists reply_to_id uuid,
  add column if not exists pinned_by uuid[] not null default '{}',
  add column if not exists reactions jsonb not null default '{}',
  add column if not exists attachment_urls text[] not null default '{}',
  add column if not exists attachment_names text[] not null default '{}',
  add column if not exists attachment_types text[] not null default '{}';

alter table public.join_request_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_by uuid[] not null default '{}',
  add column if not exists edited_at timestamptz,
  add column if not exists reply_to_id uuid,
  add column if not exists pinned_by uuid[] not null default '{}',
  add column if not exists reactions jsonb not null default '{}',
  add column if not exists attachment_urls text[] not null default '{}',
  add column if not exists attachment_names text[] not null default '{}',
  add column if not exists attachment_types text[] not null default '{}';

alter table public.team_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_by uuid[] not null default '{}',
  add column if not exists edited_at timestamptz,
  add column if not exists reply_to_id uuid,
  add column if not exists pinned_by uuid[] not null default '{}',
  add column if not exists reactions jsonb not null default '{}',
  add column if not exists attachment_urls text[] not null default '{}',
  add column if not exists attachment_names text[] not null default '{}',
  add column if not exists attachment_types text[] not null default '{}';

create table if not exists public.message_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'online',
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_typing (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(thread_id, user_id)
);

grant select, insert, update on public.message_presence to authenticated;
grant select, insert, update, delete on public.message_typing to authenticated;
grant all on public.message_presence to service_role;
grant all on public.message_typing to service_role;

alter table public.message_presence enable row level security;
alter table public.message_typing enable row level security;

do $$ begin
  create policy "Authenticated users read presence"
    on public.message_presence for select
    to authenticated
    using (true);

  create policy "Users manage own presence"
    on public.message_presence for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

  create policy "Authenticated users read typing"
    on public.message_typing for select
    to authenticated
    using (true);

  create policy "Users manage own typing"
    on public.message_typing for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', true)
on conflict (id) do nothing;

do $$ begin
  create policy "Public read message attachments"
    on storage.objects for select
    using (bucket_id = 'message-attachments');

  create policy "Users upload own message attachments"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'message-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
exception when duplicate_object then null;
end $$;

alter publication supabase_realtime add table public.message_presence;
alter publication supabase_realtime add table public.message_typing;
