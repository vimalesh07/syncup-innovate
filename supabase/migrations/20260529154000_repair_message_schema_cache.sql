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

grant update on public.direct_messages to authenticated;
grant update on public.join_request_messages to authenticated;

notify pgrst, 'reload schema';
