create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'viewer' check (role in ('viewer','analyst','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text generated always as (lower(trim(name))) stored,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (normalized_name)
);

create table public.marketplaces (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  adapter_key text not null,
  shipping_mode text not null default 'OPTIONAL' check (shipping_mode in ('NONE','OPTIONAL','REQUIRED')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.fiscal_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('NACIONAL','NACIONAL_ST','IMPORTADO','IMPORTADO_ST','ISENTO')),
  name text not null,
  has_st boolean not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  fiscal_rule_id uuid not null references public.fiscal_rules(id),
  sku text not null unique,
  manufacturer_code text,
  name text not null,
  cost numeric(18,6) not null check (cost >= 0),
  st_amount numeric(18,6),
  input_icms_rate numeric(9,8) not null default 0 check (input_icms_rate between 0 and 1),
  input_pis_rate numeric(9,8) not null default 0 check (input_pis_rate between 0 and 1),
  input_cofins_rate numeric(9,8) not null default 0 check (input_cofins_rate between 0 and 1),
  input_ipi_rate numeric(9,8) not null default 0 check (input_ipi_rate between 0 and 1),
  output_icms_sp_rate numeric(9,8) not null default 0 check (output_icms_sp_rate between 0 and 1),
  output_icms_south_southeast_rate numeric(9,8) not null default 0 check (output_icms_south_southeast_rate between 0 and 1),
  output_icms_north_northeast_rate numeric(9,8) not null default 0 check (output_icms_north_northeast_rate between 0 and 1),
  units_per_box integer check (units_per_box is null or units_per_box > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index products_supplier_idx on public.products (supplier_id) where active;
create index products_fiscal_rule_idx on public.products (fiscal_rule_id) where active;
create index products_name_search_idx on public.products using gin (to_tsvector('simple', sku || ' ' || coalesce(manufacturer_code,'') || ' ' || name));

create table public.product_marketplace_configs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  marketplace_id uuid not null references public.marketplaces(id),
  listing_type text not null default 'PADRAO',
  current_sale_price numeric(18,6) check (current_sale_price is null or current_sale_price > 0),
  commission_rate_override numeric(9,8) check (commission_rate_override is null or commission_rate_override between 0 and 1),
  fixed_fee_override numeric(18,6) check (fixed_fee_override is null or fixed_fee_override >= 0),
  freight_cost numeric(18,6) check (freight_cost is null or freight_cost >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (product_id, marketplace_id, listing_type)
);

create index product_marketplace_product_idx on public.product_marketplace_configs (product_id) where active;

create table public.marketplace_fee_rule_sets (
  id uuid primary key default gen_random_uuid(),
  marketplace_id uuid not null references public.marketplaces(id),
  listing_type text not null default 'PADRAO',
  version integer not null check (version > 0),
  name text not null,
  effective_from date not null,
  effective_to date,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','RETIRED')),
  change_reason text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (marketplace_id, listing_type, version),
  check (effective_to is null or effective_to >= effective_from)
);

create index fee_rule_sets_lookup_idx on public.marketplace_fee_rule_sets (marketplace_id, listing_type, effective_from desc) where status = 'PUBLISHED';

create table public.marketplace_fee_bands (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.marketplace_fee_rule_sets(id) on delete cascade,
  label text not null,
  min_price numeric(18,6) not null check (min_price >= 0),
  max_price numeric(18,6),
  percentage_rate numeric(9,8) not null check (percentage_rate between 0 and 1),
  fixed_fee numeric(18,6) not null default 0 check (fixed_fee >= 0),
  sort_order integer not null,
  unique (rule_set_id, sort_order),
  check (max_price is null or max_price > min_price)
);

create table public.calculation_rule_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  code text not null unique,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','RETIRED')),
  specification jsonb not null,
  change_reason text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.margin_classifications (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  tone text not null check (tone in ('danger','warning','acceptable','success')),
  min_percent numeric(9,8),
  max_percent numeric(9,8),
  version integer not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (version, label),
  check (max_percent is null or min_percent is null or max_percent > min_percent)
);

create table public.pricing_calculations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  marketplace_id uuid not null references public.marketplaces(id),
  fee_rule_set_id uuid references public.marketplace_fee_rule_sets(id),
  calculation_rule_version_id uuid references public.calculation_rule_versions(id),
  listing_type text not null,
  sale_price numeric(18,6) not null check (sale_price > 0),
  shipping_cost numeric(18,6) not null default 0 check (shipping_cost >= 0),
  results jsonb not null,
  input_snapshot jsonb not null,
  rule_snapshot jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index pricing_history_product_idx on public.pricing_calculations (product_id, created_at desc);
create index pricing_history_marketplace_idx on public.pricing_calculations (marketplace_id, created_at desc);

create table public.repricing_queue (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  marketplace_id uuid references public.marketplaces(id),
  reason text not null,
  source_type text not null,
  source_id uuid,
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED','DISMISSED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

create index repricing_queue_open_idx on public.repricing_queue (created_at desc) where status in ('OPEN','IN_PROGRESS');

create table public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create index audit_logs_record_idx on public.audit_logs (table_name, record_id, changed_at desc);

create or replace function private.has_any_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and active and role = any(allowed_roles)
  );
$$;
revoke all on function private.has_any_role(text[]) from public;
grant execute on function private.has_any_role(text[]) to authenticated;

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs(table_name, record_id, operation, old_values, new_values, changed_by)
  values (
    tg_table_name,
    coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    (select auth.uid())
  );
  return coalesce(new, old);
end;
$$;
revoke all on function private.audit_row_change() from public;

create or replace function private.validate_product_st()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare rule_has_st boolean;
begin
  select has_st into rule_has_st from public.fiscal_rules where id = new.fiscal_rule_id;
  if coalesce(new.st_amount, 0) > 0 and not coalesce(rule_has_st, false) then
    raise exception 'st_amount somente pode ser informado para uma regra fiscal ST';
  end if;
  if coalesce(rule_has_st, false) and new.st_amount is null then
    raise exception 'st_amount é obrigatório para uma regra fiscal ST';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_product_st() from public;

create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
revoke all on function private.create_profile_for_new_user() from public;

create trigger validate_product_st before insert or update of fiscal_rule_id, st_amount on public.products for each row execute function private.validate_product_st();
create trigger create_profile_after_signup after insert on auth.users for each row execute function private.create_profile_for_new_user();

create trigger audit_suppliers after insert or update or delete on public.suppliers for each row execute function private.audit_row_change();
create trigger audit_products after insert or update or delete on public.products for each row execute function private.audit_row_change();
create trigger audit_marketplaces after insert or update or delete on public.marketplaces for each row execute function private.audit_row_change();
create trigger audit_product_marketplace_configs after insert or update or delete on public.product_marketplace_configs for each row execute function private.audit_row_change();
create trigger audit_fee_rule_sets after insert or update or delete on public.marketplace_fee_rule_sets for each row execute function private.audit_row_change();
create trigger audit_calculation_rules after insert or update or delete on public.calculation_rule_versions for each row execute function private.audit_row_change();

alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.marketplaces enable row level security;
alter table public.fiscal_rules enable row level security;
alter table public.products enable row level security;
alter table public.product_marketplace_configs enable row level security;
alter table public.marketplace_fee_rule_sets enable row level security;
alter table public.marketplace_fee_bands enable row level security;
alter table public.calculation_rule_versions enable row level security;
alter table public.margin_classifications enable row level security;
alter table public.pricing_calculations enable row level security;
alter table public.repricing_queue enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.suppliers, public.marketplaces, public.fiscal_rules, public.products, public.product_marketplace_configs, public.marketplace_fee_rule_sets, public.marketplace_fee_bands, public.calculation_rule_versions, public.margin_classifications, public.pricing_calculations, public.repricing_queue to authenticated;
grant insert, update on public.suppliers, public.products, public.product_marketplace_configs, public.repricing_queue to authenticated;
grant insert on public.pricing_calculations to authenticated;
grant select on public.profiles, public.audit_logs to authenticated;
grant insert, update on public.marketplaces, public.fiscal_rules, public.marketplace_fee_rule_sets, public.marketplace_fee_bands, public.calculation_rule_versions, public.margin_classifications to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or private.has_any_role(array['admin']));
create policy profiles_admin_update on public.profiles for update to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));

create policy internal_read_suppliers on public.suppliers for select to authenticated using ((select auth.uid()) is not null);
create policy internal_write_suppliers on public.suppliers for all to authenticated using (private.has_any_role(array['analyst','admin'])) with check (private.has_any_role(array['analyst','admin']));
create policy internal_read_products on public.products for select to authenticated using ((select auth.uid()) is not null);
create policy internal_write_products on public.products for all to authenticated using (private.has_any_role(array['analyst','admin'])) with check (private.has_any_role(array['analyst','admin']));
create policy internal_read_product_configs on public.product_marketplace_configs for select to authenticated using ((select auth.uid()) is not null);
create policy internal_write_product_configs on public.product_marketplace_configs for all to authenticated using (private.has_any_role(array['analyst','admin'])) with check (private.has_any_role(array['analyst','admin']));
create policy internal_read_marketplaces on public.marketplaces for select to authenticated using ((select auth.uid()) is not null);
create policy admin_write_marketplaces on public.marketplaces for all to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));
create policy internal_read_fiscal_rules on public.fiscal_rules for select to authenticated using ((select auth.uid()) is not null);
create policy admin_write_fiscal_rules on public.fiscal_rules for all to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));
create policy internal_read_fee_sets on public.marketplace_fee_rule_sets for select to authenticated using ((select auth.uid()) is not null);
create policy admin_write_fee_sets on public.marketplace_fee_rule_sets for all to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));
create policy internal_read_fee_bands on public.marketplace_fee_bands for select to authenticated using ((select auth.uid()) is not null);
create policy admin_write_fee_bands on public.marketplace_fee_bands for all to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));
create policy internal_read_calculation_rules on public.calculation_rule_versions for select to authenticated using ((select auth.uid()) is not null);
create policy admin_write_calculation_rules on public.calculation_rule_versions for all to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));
create policy internal_read_classifications on public.margin_classifications for select to authenticated using ((select auth.uid()) is not null);
create policy admin_write_classifications on public.margin_classifications for all to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));
create policy internal_read_pricing on public.pricing_calculations for select to authenticated using ((select auth.uid()) is not null);
create policy user_insert_pricing on public.pricing_calculations for insert to authenticated with check (created_by = (select auth.uid()));
create policy internal_read_queue on public.repricing_queue for select to authenticated using ((select auth.uid()) is not null);
create policy analyst_write_queue on public.repricing_queue for all to authenticated using (private.has_any_role(array['analyst','admin'])) with check (private.has_any_role(array['analyst','admin']));
create policy audit_read on public.audit_logs for select to authenticated using (private.has_any_role(array['analyst','admin']));

insert into public.fiscal_rules(code,name,has_st) values
  ('NACIONAL','Nacional',false),('NACIONAL_ST','Nacional ST',true),('IMPORTADO','Importado',false),('IMPORTADO_ST','Importado ST',true),('ISENTO','Isento',false);

insert into public.marketplaces(code,name,adapter_key,shipping_mode) values
  ('MERCADO_LIVRE','Mercado Livre','percentage_listing','REQUIRED'),
  ('SHOPEE','Shopee','price_band','NONE'),
  ('AMAZON','Amazon','percentage','REQUIRED');

insert into public.calculation_rule_versions(version,code,status,specification,change_reason,effective_from) values
  (1,'recommended-v1','PUBLISHED','{"decimalPrecision":32,"rounding":"HALF_UP","outputPisRate":"0","outputCofinsRate":"0","amazonPisCofinsBase":"costMinusIcmsCredit"}'::jsonb,'Primeira versão aprovada após engenharia reversa','2026-08-31T00:00:00-03:00');

insert into public.margin_classifications(label,tone,min_percent,max_percent,version) values
  ('RUIM','danger',null,0.05,1),('ATENÇÃO','warning',0.05,0.09,1),('ACEITÁVEL','acceptable',0.09,0.10,1),('OK','success',0.10,null,1);

with rule_set as (
  insert into public.marketplace_fee_rule_sets(marketplace_id,listing_type,version,name,effective_from,status,change_reason)
  select id,'PADRAO',1,'Faixas Shopee confirmadas no Excel','2026-01-01','PUBLISHED','Migração da calculadora legada'
  from public.marketplaces where code='SHOPEE' returning id
)
insert into public.marketplace_fee_bands(rule_set_id,label,min_price,max_price,percentage_rate,fixed_fee,sort_order)
select id,label,min_price,max_price,percentage_rate,fixed_fee,sort_order from rule_set cross join (values
  ('Até R$ 79,99',0::numeric,80::numeric,0.20::numeric,4::numeric,1),
  ('R$ 80 a R$ 99,99',80,100,0.14,16,2),
  ('R$ 100 a R$ 199,99',100,200,0.14,20,3),
  ('R$ 200 ou mais',200,null,0.14,26,4)
) as bands(label,min_price,max_price,percentage_rate,fixed_fee,sort_order);
