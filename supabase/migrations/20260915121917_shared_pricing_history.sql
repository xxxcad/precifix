create table public.manual_pricing_calculations (
  id uuid primary key default gen_random_uuid(),
  marketplace_id uuid not null references public.marketplaces(id),
  fee_rule_set_id uuid references public.marketplace_fee_rule_sets(id),
  calculation_rule_version_id uuid references public.calculation_rule_versions(id),
  shipping_rule_set_id uuid references public.marketplace_shipping_rule_sets(id),
  listing_type text not null check (listing_type in ('CLASSICO', 'PREMIUM', 'PADRAO')),
  sale_price numeric(18,6) not null check (sale_price > 0),
  shipping_cost numeric(18,6) not null default 0 check (shipping_cost >= 0),
  results jsonb not null,
  input_snapshot jsonb not null,
  rule_snapshot jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index manual_pricing_calculations_created_at_idx
  on public.manual_pricing_calculations (created_at desc);

create index manual_pricing_calculations_created_by_idx
  on public.manual_pricing_calculations (created_by, created_at desc);

alter table public.manual_pricing_calculations enable row level security;

revoke all on public.manual_pricing_calculations from anon, authenticated;
grant select, insert on public.manual_pricing_calculations to authenticated;

create policy manual_pricing_internal_read
on public.manual_pricing_calculations
for select
to authenticated
using ((select auth.uid()) is not null);

create policy manual_pricing_user_insert
on public.manual_pricing_calculations
for insert
to authenticated
with check (created_by = (select auth.uid()));
