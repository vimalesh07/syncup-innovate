alter table public.notifications
  add column if not exists metadata jsonb not null default '{}';

notify pgrst, 'reload schema';
