set local lock_timeout = '5s';

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

alter table public.fiscal_rules
  drop column if exists input_icms_rate,
  drop column if exists input_pis_rate,
  drop column if exists input_cofins_rate,
  drop column if exists input_ipi_rate;
