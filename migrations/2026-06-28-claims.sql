create table if not exists public.claims (
    id uuid primary key default gen_random_uuid(),
    sale_id uuid references public.sales(id) on delete set null,
    customer_id uuid references public.customers(id) on delete set null,
    type text not null default 'complaint',
    reason text not null default 'other',
    fault_side text not null default 'unclear',
    resolution text not null default 'compensation_bouquet',
    status text not null default 'open',
    refund_amount numeric not null default 0,
    compensation_cost numeric not null default 0,
    loss_amount numeric not null default 0,
    compensation_composition jsonb not null default '[]'::jsonb,
    comment text,
    created_at timestamptz not null default now(),
    updated_at timestamptz
);

create index if not exists claims_sale_id_idx on public.claims(sale_id);
create index if not exists claims_customer_id_idx on public.claims(customer_id);
create index if not exists claims_status_idx on public.claims(status);
create index if not exists claims_created_at_idx on public.claims(created_at desc);

alter table public.claims enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'claims'
          and policyname = 'claims_all_access'
    ) then
        create policy claims_all_access on public.claims
            for all
            using (true)
            with check (true);
    end if;
end $$;
