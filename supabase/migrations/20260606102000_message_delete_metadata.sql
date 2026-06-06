alter table public.direct_messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.join_request_messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.team_messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists reply_to_id uuid,
  add column if not exists reactions jsonb not null default '{}'::jsonb;

grant update on public.team_messages to authenticated;
