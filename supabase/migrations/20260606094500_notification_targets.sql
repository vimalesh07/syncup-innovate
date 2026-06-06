alter table public.notifications
  add column if not exists type text,
  add column if not exists target_path text;

notify pgrst, 'reload schema';
