create or replace function private.repricing_money(value numeric)
returns text language sql immutable set search_path = ''
as $$ select case when value is null then 'não informado' else 'R$ ' || replace(to_char(value, 'FM999999990.00'), '.', ',') end $$;

create or replace function private.repricing_percent(value numeric)
returns text language sql immutable set search_path = ''
as $$ select case when value is null then 'não informada' else replace(to_char(value * 100, 'FM999990.00'), '.', ',') || '%' end $$;

revoke all on function private.repricing_money(numeric) from public, anon, authenticated;
revoke all on function private.repricing_percent(numeric) from public, anon, authenticated;

create or replace function private.enqueue_repricing(
  target_product_id uuid,
  target_marketplace_id uuid,
  queue_reason text,
  queue_source_type text,
  queue_source_id uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.repricing_queue(product_id, marketplace_id, reason, source_type, source_id)
  values (target_product_id, target_marketplace_id, queue_reason, queue_source_type, queue_source_id);
end;
$$;
revoke all on function private.enqueue_repricing(uuid,uuid,text,text,uuid) from public, anon, authenticated;

create or replace function private.track_product_repricing()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare old_rule text; new_rule text;
begin
  if old.cost is distinct from new.cost then
    insert into public.product_cost_history(product_id,old_cost,new_cost,changed_by)
    values(new.id,old.cost,new.cost,(select auth.uid()));
    perform private.enqueue_repricing(new.id,null,'O custo do produto mudou de ' || private.repricing_money(old.cost) || ' para ' || private.repricing_money(new.cost) || '.','PRODUCT_COST_CHANGE',new.id);
  end if;
  if old.fiscal_rule_id is distinct from new.fiscal_rule_id then
    select name into old_rule from public.fiscal_rules where id=old.fiscal_rule_id;
    select name into new_rule from public.fiscal_rules where id=new.fiscal_rule_id;
    perform private.enqueue_repricing(new.id,null,'A regra fiscal mudou de ' || coalesce(old_rule,'não informada') || ' para ' || coalesce(new_rule,'não informada') || '.','PRODUCT_FISCAL_RULE_CHANGE',new.id);
  end if;
  if old.st_amount is distinct from new.st_amount then perform private.enqueue_repricing(new.id,null,'O valor de ST mudou de '||private.repricing_money(old.st_amount)||' para '||private.repricing_money(new.st_amount)||'.','PRODUCT_TAX_CHANGE',new.id); end if;
  if old.input_icms_rate is distinct from new.input_icms_rate then perform private.enqueue_repricing(new.id,null,'O ICMS de entrada mudou de '||private.repricing_percent(old.input_icms_rate)||' para '||private.repricing_percent(new.input_icms_rate)||'.','PRODUCT_TAX_CHANGE',new.id); end if;
  if old.input_pis_rate is distinct from new.input_pis_rate then perform private.enqueue_repricing(new.id,null,'O PIS de entrada mudou de '||private.repricing_percent(old.input_pis_rate)||' para '||private.repricing_percent(new.input_pis_rate)||'.','PRODUCT_TAX_CHANGE',new.id); end if;
  if old.input_cofins_rate is distinct from new.input_cofins_rate then perform private.enqueue_repricing(new.id,null,'O COFINS de entrada mudou de '||private.repricing_percent(old.input_cofins_rate)||' para '||private.repricing_percent(new.input_cofins_rate)||'.','PRODUCT_TAX_CHANGE',new.id); end if;
  if old.input_ipi_rate is distinct from new.input_ipi_rate then perform private.enqueue_repricing(new.id,null,'O IPI de entrada mudou de '||private.repricing_percent(old.input_ipi_rate)||' para '||private.repricing_percent(new.input_ipi_rate)||'.','PRODUCT_TAX_CHANGE',new.id); end if;
  if old.output_icms_sp_rate is distinct from new.output_icms_sp_rate then perform private.enqueue_repricing(new.id,null,'O ICMS de saída SP mudou de '||private.repricing_percent(old.output_icms_sp_rate)||' para '||private.repricing_percent(new.output_icms_sp_rate)||'.','PRODUCT_TAX_CHANGE',new.id); end if;
  if old.output_icms_south_southeast_rate is distinct from new.output_icms_south_southeast_rate then perform private.enqueue_repricing(new.id,null,'O ICMS de saída Sul/Sudeste mudou de '||private.repricing_percent(old.output_icms_south_southeast_rate)||' para '||private.repricing_percent(new.output_icms_south_southeast_rate)||'.','PRODUCT_TAX_CHANGE',new.id); end if;
  if old.output_icms_north_northeast_rate is distinct from new.output_icms_north_northeast_rate then perform private.enqueue_repricing(new.id,null,'O ICMS de saída Norte/Nordeste mudou de '||private.repricing_percent(old.output_icms_north_northeast_rate)||' para '||private.repricing_percent(new.output_icms_north_northeast_rate)||'.','PRODUCT_TAX_CHANGE',new.id); end if;
  if old.package_weight_kg is distinct from new.package_weight_kg then perform private.enqueue_repricing(new.id,null,'O peso da embalagem mudou de '||coalesce(old.package_weight_kg::text,'não informado')||' kg para '||coalesce(new.package_weight_kg::text,'não informado')||' kg.','PRODUCT_PACKAGING_CHANGE',new.id); end if;
  if old.package_height_cm is distinct from new.package_height_cm then perform private.enqueue_repricing(new.id,null,'A altura da embalagem mudou de '||coalesce(old.package_height_cm::text,'não informada')||' cm para '||coalesce(new.package_height_cm::text,'não informada')||' cm.','PRODUCT_PACKAGING_CHANGE',new.id); end if;
  if old.package_width_cm is distinct from new.package_width_cm then perform private.enqueue_repricing(new.id,null,'A largura da embalagem mudou de '||coalesce(old.package_width_cm::text,'não informada')||' cm para '||coalesce(new.package_width_cm::text,'não informada')||' cm.','PRODUCT_PACKAGING_CHANGE',new.id); end if;
  if old.package_length_cm is distinct from new.package_length_cm then perform private.enqueue_repricing(new.id,null,'O comprimento da embalagem mudou de '||coalesce(old.package_length_cm::text,'não informado')||' cm para '||coalesce(new.package_length_cm::text,'não informado')||' cm.','PRODUCT_PACKAGING_CHANGE',new.id); end if;
  return new;
end;
$$;
revoke all on function private.track_product_repricing() from public, anon, authenticated;

create or replace function private.track_product_marketplace_repricing()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare marketplace_name text; fee_name text;
begin
  select name into marketplace_name from public.marketplaces where id=new.marketplace_id;
  fee_name := case
    when marketplace_name='Mercado Livre' and upper(new.listing_type)='CLASSICO' then 'A Taxa ML Clássico'
    when marketplace_name='Mercado Livre' and upper(new.listing_type)='PREMIUM' then 'A Taxa ML Premium'
    when marketplace_name='Amazon' then 'A Taxa Tarifa Amazon'
    else 'A comissão da ' || marketplace_name
  end;
  if old.commission_rate_override is distinct from new.commission_rate_override then perform private.enqueue_repricing(new.product_id,new.marketplace_id,fee_name||' mudou de '||private.repricing_percent(old.commission_rate_override)||' para '||private.repricing_percent(new.commission_rate_override)||'.','PRODUCT_MARKETPLACE_COMMISSION_CHANGE',new.id); end if;
  if old.fixed_fee_override is distinct from new.fixed_fee_override then perform private.enqueue_repricing(new.product_id,new.marketplace_id,'A tarifa fixa da '||marketplace_name||' mudou de '||private.repricing_money(old.fixed_fee_override)||' para '||private.repricing_money(new.fixed_fee_override)||'.','PRODUCT_MARKETPLACE_FIXED_FEE_CHANGE',new.id); end if;
  if old.freight_cost is distinct from new.freight_cost then perform private.enqueue_repricing(new.product_id,new.marketplace_id,'O frete cadastrado da '||marketplace_name||' mudou de '||private.repricing_money(old.freight_cost)||' para '||private.repricing_money(new.freight_cost)||'.','PRODUCT_MARKETPLACE_FREIGHT_CHANGE',new.id); end if;
  if old.listing_type is distinct from new.listing_type then perform private.enqueue_repricing(new.product_id,new.marketplace_id,'A modalidade do anúncio na '||marketplace_name||' mudou de '||old.listing_type||' para '||new.listing_type||'.','PRODUCT_MARKETPLACE_LISTING_CHANGE',new.id); end if;
  return new;
end;
$$;
revoke all on function private.track_product_marketplace_repricing() from public, anon, authenticated;

create or replace function private.track_fiscal_rule_repricing()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare item record;
begin
  if old.name is distinct from new.name then for item in select id from public.products where fiscal_rule_id=new.id and active loop perform private.enqueue_repricing(item.id,null,'O nome da regra fiscal mudou de '||old.name||' para '||new.name||'.','FISCAL_RULE_CHANGE',new.id); end loop; end if;
  if old.has_st is distinct from new.has_st then for item in select id from public.products where fiscal_rule_id=new.id and active loop perform private.enqueue_repricing(item.id,null,'A aplicação de ST na regra '||new.name||' mudou de '||case when old.has_st then 'Sim' else 'Não' end||' para '||case when new.has_st then 'Sim' else 'Não' end||'.','FISCAL_RULE_CHANGE',new.id); end loop; end if;
  if old.active is distinct from new.active then for item in select id from public.products where fiscal_rule_id=new.id and active loop perform private.enqueue_repricing(item.id,null,'O status da regra fiscal '||new.name||' mudou de '||case when old.active then 'Ativa' else 'Inativa' end||' para '||case when new.active then 'Ativa' else 'Inativa' end||'.','FISCAL_RULE_CHANGE',new.id); end loop; end if;
  if old.output_icms_sp_rate is distinct from new.output_icms_sp_rate then for item in select id from public.products where fiscal_rule_id=new.id and active loop perform private.enqueue_repricing(item.id,null,'O ICMS de saída SP da regra '||new.name||' mudou de '||private.repricing_percent(old.output_icms_sp_rate)||' para '||private.repricing_percent(new.output_icms_sp_rate)||'.','FISCAL_RULE_CHANGE',new.id); end loop; end if;
  if old.output_icms_south_southeast_rate is distinct from new.output_icms_south_southeast_rate then for item in select id from public.products where fiscal_rule_id=new.id and active loop perform private.enqueue_repricing(item.id,null,'O ICMS de saída Sul/Sudeste da regra '||new.name||' mudou de '||private.repricing_percent(old.output_icms_south_southeast_rate)||' para '||private.repricing_percent(new.output_icms_south_southeast_rate)||'.','FISCAL_RULE_CHANGE',new.id); end loop; end if;
  if old.output_icms_north_northeast_rate is distinct from new.output_icms_north_northeast_rate then for item in select id from public.products where fiscal_rule_id=new.id and active loop perform private.enqueue_repricing(item.id,null,'O ICMS de saída Norte/Nordeste da regra '||new.name||' mudou de '||private.repricing_percent(old.output_icms_north_northeast_rate)||' para '||private.repricing_percent(new.output_icms_north_northeast_rate)||'.','FISCAL_RULE_CHANGE',new.id); end loop; end if;
  return new;
end;
$$;
revoke all on function private.track_fiscal_rule_repricing() from public, anon, authenticated;

with changes as (
  select distinct on(q.id) q.id,m.name marketplace_name,a.old_values,a.new_values
  from public.repricing_queue q
  join public.marketplaces m on m.id=q.marketplace_id
  join public.audit_logs a on a.record_id=q.source_id and a.operation='UPDATE' and a.changed_at between q.created_at-interval '5 seconds' and q.created_at+interval '5 seconds'
  where q.status in('OPEN','IN_PROGRESS') and q.reason='comissão, tarifa ou frete do produto alterado'
  order by q.id,abs(extract(epoch from(a.changed_at-q.created_at)))
)
update public.repricing_queue q set reason=case
  when c.old_values->>'commission_rate_override' is distinct from c.new_values->>'commission_rate_override' then
    case when c.marketplace_name='Amazon' then 'A Taxa Tarifa Amazon' else 'A comissão da '||c.marketplace_name end||' mudou de '||private.repricing_percent((c.old_values->>'commission_rate_override')::numeric)||' para '||private.repricing_percent((c.new_values->>'commission_rate_override')::numeric)||'.'
  when c.old_values->>'fixed_fee_override' is distinct from c.new_values->>'fixed_fee_override' then 'A tarifa fixa da '||c.marketplace_name||' mudou de '||private.repricing_money((c.old_values->>'fixed_fee_override')::numeric)||' para '||private.repricing_money((c.new_values->>'fixed_fee_override')::numeric)||'.'
  when c.old_values->>'freight_cost' is distinct from c.new_values->>'freight_cost' then 'O frete cadastrado da '||c.marketplace_name||' mudou de '||private.repricing_money((c.old_values->>'freight_cost')::numeric)||' para '||private.repricing_money((c.new_values->>'freight_cost')::numeric)||'.'
  else q.reason end
from changes c where q.id=c.id;
