alter table public.goods
  add column if not exists family_name text,
  add column if not exists variant_name text,
  add column if not exists attributes jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
