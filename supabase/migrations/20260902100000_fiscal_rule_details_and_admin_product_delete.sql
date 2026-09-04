alter table public.fiscal_rules
  drop constraint if exists fiscal_rules_code_check,
  add column input_icms_rate numeric(9,8) not null default 0 check (input_icms_rate between 0 and 1),
  add column input_pis_rate numeric(9,8) not null default 0 check (input_pis_rate between 0 and 1),
  add column input_cofins_rate numeric(9,8) not null default 0 check (input_cofins_rate between 0 and 1),
  add column input_ipi_rate numeric(9,8) not null default 0 check (input_ipi_rate between 0 and 1),
  add column output_icms_sp_rate numeric(9,8) not null default 0 check (output_icms_sp_rate between 0 and 1),
  add column output_icms_south_southeast_rate numeric(9,8) not null default 0 check (output_icms_south_southeast_rate between 0 and 1),
  add column output_icms_north_northeast_rate numeric(9,8) not null default 0 check (output_icms_north_northeast_rate between 0 and 1),
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid references auth.users(id),
  add constraint fiscal_rules_code_format check (code ~ '^[A-Z][A-Z0-9_]{1,39}$');

update public.fiscal_rules set
  input_icms_rate = case code when 'NACIONAL' then 0.18 when 'IMPORTADO' then 0.18 else 0 end,
  input_pis_rate = case when code = 'ISENTO' then 0 else 0.0165 end,
  input_cofins_rate = case when code = 'ISENTO' then 0 else 0.076 end,
  input_ipi_rate = 0,
  output_icms_sp_rate = case code when 'NACIONAL' then 0.18 when 'IMPORTADO' then 0.18 else 0 end,
  output_icms_south_southeast_rate = case when code like 'NACIONAL%' then 0.12 when code like 'IMPORTADO%' then 0.04 else 0 end,
  output_icms_north_northeast_rate = case when code like 'NACIONAL%' then 0.07 when code like 'IMPORTADO%' then 0.04 else 0 end,
  updated_at = now();

drop policy if exists internal_write_products on public.products;
drop policy if exists analyst_insert_products on public.products;
drop policy if exists analyst_update_products on public.products;
drop policy if exists admin_delete_products on public.products;
create policy analyst_insert_products on public.products for insert to authenticated
  with check (private.has_any_role(array['analyst','admin']));
create policy analyst_update_products on public.products for update to authenticated
  using (private.has_any_role(array['analyst','admin']))
  with check (private.has_any_role(array['analyst','admin']));
create policy admin_delete_products on public.products for delete to authenticated
  using (private.has_any_role(array['admin']));
grant delete on public.products to authenticated;

create or replace function private.track_fiscal_rule_repricing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare item record;
begin
  if old.name is distinct from new.name
    or old.has_st is distinct from new.has_st
    or old.active is distinct from new.active
    or old.input_icms_rate is distinct from new.input_icms_rate
    or old.input_pis_rate is distinct from new.input_pis_rate
    or old.input_cofins_rate is distinct from new.input_cofins_rate
    or old.input_ipi_rate is distinct from new.input_ipi_rate
    or old.output_icms_sp_rate is distinct from new.output_icms_sp_rate
    or old.output_icms_south_southeast_rate is distinct from new.output_icms_south_southeast_rate
    or old.output_icms_north_northeast_rate is distinct from new.output_icms_north_northeast_rate then
    for item in select id from public.products where fiscal_rule_id = new.id and active loop
      perform private.enqueue_repricing(item.id, null, 'regra fiscal relacionada alterada', 'FISCAL_RULE_CHANGE', new.id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger audit_fiscal_rules after insert or update or delete on public.fiscal_rules
for each row execute function private.audit_row_change();
