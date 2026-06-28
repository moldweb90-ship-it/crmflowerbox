alter table public.settings
    add column if not exists local_admin_password_hash text,
    add column if not exists local_admin_password_salt text;

notify pgrst, 'reload schema';
