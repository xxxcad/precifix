alter table public.suppliers add column logo_path text;

create table public.product_cost_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  old_cost numeric(18,6) not null,
  new_cost numeric(18,6) not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  change_reason text
);

create index product_cost_history_product_idx on public.product_cost_history (product_id, changed_at desc);
create index product_cost_history_changed_by_idx on public.product_cost_history (changed_by) where changed_by is not null;
alter table public.product_cost_history enable row level security;
revoke all on public.product_cost_history from anon, authenticated;
grant select, insert on public.product_cost_history to authenticated;
create policy internal_read_product_cost_history on public.product_cost_history
  for select to authenticated using (private.has_any_role(array['analyst','admin']));
create policy analyst_insert_product_cost_history on public.product_cost_history
  for insert to authenticated with check (private.has_any_role(array['analyst','admin']) and changed_by = (select auth.uid()));

create or replace function private.enqueue_repricing(
  target_product_id uuid,
  target_marketplace_id uuid,
  queue_reason text,
  queue_source_type text,
  queue_source_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.repricing_queue q
    where q.product_id = target_product_id
      and q.marketplace_id is not distinct from target_marketplace_id
      and q.status in ('OPEN','IN_PROGRESS')
  ) then
    insert into public.repricing_queue(product_id, marketplace_id, reason, source_type, source_id)
    values (target_product_id, target_marketplace_id, queue_reason, queue_source_type, queue_source_id);
  end if;
end;
$$;
revoke all on function private.enqueue_repricing(uuid,uuid,text,text,uuid) from public;

create or replace function private.track_product_repricing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare reasons text[] := array[]::text[];
begin
  if old.cost is distinct from new.cost then
    insert into public.product_cost_history(product_id, old_cost, new_cost, changed_by)
    values (new.id, old.cost, new.cost, (select auth.uid()));
    reasons := array_append(reasons, 'custo alterado de R$ ' || old.cost || ' para R$ ' || new.cost);
  end if;
  if old.fiscal_rule_id is distinct from new.fiscal_rule_id then
    reasons := array_append(reasons, 'regra fiscal alterada');
  end if;
  if old.st_amount is distinct from new.st_amount
    or old.input_icms_rate is distinct from new.input_icms_rate
    or old.input_pis_rate is distinct from new.input_pis_rate
    or old.input_cofins_rate is distinct from new.input_cofins_rate
    or old.input_ipi_rate is distinct from new.input_ipi_rate
    or old.output_icms_sp_rate is distinct from new.output_icms_sp_rate
    or old.output_icms_south_southeast_rate is distinct from new.output_icms_south_southeast_rate
    or old.output_icms_north_northeast_rate is distinct from new.output_icms_north_northeast_rate then
    reasons := array_append(reasons, 'parâmetros fiscais alterados');
  end if;
  if array_length(reasons, 1) > 0 then
    perform private.enqueue_repricing(new.id, null, array_to_string(reasons, '; '), 'PRODUCT_CHANGE', new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.track_product_repricing() from public;
create trigger track_product_repricing after update on public.products
for each row execute function private.track_product_repricing();

create or replace function private.track_product_marketplace_repricing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.commission_rate_override is distinct from new.commission_rate_override
    or old.fixed_fee_override is distinct from new.fixed_fee_override
    or old.freight_cost is distinct from new.freight_cost
    or old.listing_type is distinct from new.listing_type then
    perform private.enqueue_repricing(new.product_id, new.marketplace_id, 'comissão, tarifa ou frete do produto alterado', 'PRODUCT_MARKETPLACE_CHANGE', new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.track_product_marketplace_repricing() from public;
create trigger track_product_marketplace_repricing after update on public.product_marketplace_configs
for each row execute function private.track_product_marketplace_repricing();

create or replace function private.queue_marketplace_products(target_marketplace_id uuid, reason text, source_type text, source_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare item record;
begin
  for item in select product_id from public.product_marketplace_configs where marketplace_id = target_marketplace_id and active loop
    perform private.enqueue_repricing(item.product_id, target_marketplace_id, reason, source_type, source_id);
  end loop;
end;
$$;
revoke all on function private.queue_marketplace_products(uuid,text,text,uuid) from public;

create or replace function private.track_fee_rule_repricing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare marketplace uuid;
declare source uuid;
begin
  source := coalesce(new.id, old.id);
  if tg_table_name = 'marketplace_fee_bands' then
    select marketplace_id into marketplace from public.marketplace_fee_rule_sets where id = coalesce(new.rule_set_id, old.rule_set_id);
  else
    marketplace := coalesce(new.marketplace_id, old.marketplace_id);
  end if;
  perform private.queue_marketplace_products(marketplace, 'tarifa ou regra do marketplace alterada', upper(tg_table_name), source);
  return coalesce(new, old);
end;
$$;
revoke all on function private.track_fee_rule_repricing() from public;
create trigger track_fee_bands_repricing after insert or update or delete on public.marketplace_fee_bands for each row execute function private.track_fee_rule_repricing();
create trigger track_fee_sets_repricing after insert or update or delete on public.marketplace_fee_rule_sets for each row execute function private.track_fee_rule_repricing();

create or replace function private.track_fiscal_rule_repricing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare item record;
begin
  if old.name is distinct from new.name or old.has_st is distinct from new.has_st or old.active is distinct from new.active then
    for item in select id from public.products where fiscal_rule_id = new.id and active loop
      perform private.enqueue_repricing(item.id, null, 'regra fiscal relacionada alterada', 'FISCAL_RULE_CHANGE', new.id);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.track_fiscal_rule_repricing() from public;
create trigger track_fiscal_rule_repricing after update on public.fiscal_rules for each row execute function private.track_fiscal_rule_repricing();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('supplier-logos', 'supplier-logos', false, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy supplier_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'supplier-logos' and private.has_any_role(array['analyst','admin']));
create policy supplier_logos_update on storage.objects for update to authenticated
  using (bucket_id = 'supplier-logos' and private.has_any_role(array['analyst','admin']))
  with check (bucket_id = 'supplier-logos' and private.has_any_role(array['analyst','admin']));
create policy supplier_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'supplier-logos' and private.has_any_role(array['analyst','admin']));
