create table public.shipping_additional_kg_rates (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.marketplace_shipping_rule_sets(id) on delete cascade,
  price_band_id uuid not null references public.shipping_price_bands(id) on delete cascade,
  cost_per_kg numeric(18,2) not null check (cost_per_kg >= 0),
  unique (rule_set_id, price_band_id)
);

create index shipping_additional_kg_rule_idx on public.shipping_additional_kg_rates (rule_set_id, price_band_id);
alter table public.shipping_additional_kg_rates enable row level security;
revoke all on public.shipping_additional_kg_rates from anon, authenticated;
grant select, insert on public.shipping_additional_kg_rates to authenticated;
create policy shipping_additional_kg_read on public.shipping_additional_kg_rates
  for select to authenticated using ((select auth.uid()) is not null);
create policy shipping_additional_kg_admin_insert on public.shipping_additional_kg_rates
  for insert to authenticated with check (private.has_any_role(array['admin']));

do $$
declare rs uuid;
begin
  insert into public.marketplace_shipping_rule_sets(marketplace_id,version,status,effective_from,source_url,change_reason)
  select id,1,'PUBLISHED',current_date,'Tabela de frete Amazon.xlsx','Tabela vigente fornecida em 04/09/2026'
  from public.marketplaces where code='AMAZON' returning id into rs;

  insert into public.shipping_price_bands(rule_set_id,label,max_price,sort_order) values
    (rs,'Até R$ 29,99',29.99,1),(rs,'R$ 30 a R$ 49,99',49.99,2),(rs,'R$ 50 a R$ 78,99',78.99,3),(rs,'R$ 79 a R$ 99,99',99.99,4),
    (rs,'R$ 100 a R$ 119,99',119.99,5),(rs,'R$ 120 a R$ 149,99',149.99,6),(rs,'R$ 150 a R$ 199,99',199.99,7),(rs,'A partir de R$ 200',null,8);

  insert into public.shipping_weight_bands(rule_set_id,label,max_weight_kg,sort_order) values
    (rs,'Até 0,1 kg',0.1,1),(rs,'De 0,1 a 0,2 kg',0.2,2),(rs,'De 0,2 a 0,3 kg',0.3,3),(rs,'De 0,3 a 0,4 kg',0.4,4),
    (rs,'De 0,4 a 0,5 kg',0.5,5),(rs,'De 0,5 a 0,75 kg',0.75,6),(rs,'De 0,75 a 1 kg',1,7),(rs,'De 1 a 1,5 kg',1.5,8),
    (rs,'De 1,5 a 2 kg',2,9),(rs,'De 2 a 3 kg',3,10),(rs,'De 3 a 4 kg',4,11),(rs,'De 4 a 5 kg',5,12),
    (rs,'De 5 a 6 kg',6,13),(rs,'De 6 a 7 kg',7,14),(rs,'De 7 a 8 kg',8,15),(rs,'De 8 a 9 kg',9,16),(rs,'De 9 a 10 kg',10,17);

  insert into public.shipping_rates(rule_set_id,price_band_id,weight_band_id,cost)
  select rs,p.id,w.id,(array[5.65,5.85,6.05,6,6,6,6,6]::numeric[])[p.sort_order]
  from public.shipping_weight_bands w cross join public.shipping_price_bands p
  where w.rule_set_id=rs and p.rule_set_id=rs;

  insert into public.shipping_additional_kg_rates(rule_set_id,price_band_id,cost_per_kg)
  select rs,p.id,0 from public.shipping_price_bands p where p.rule_set_id=rs;
end $$;

create or replace function public.publish_amazon_shipping_rule(payload jsonb, reason text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare market uuid; current_set public.marketplace_shipping_rule_sets; new_set uuid;
begin
  if not private.has_any_role(array['admin']) then raise exception 'Somente administradores podem publicar regras de frete'; end if;
  if length(trim(reason)) < 5 then raise exception 'Informe o motivo da alteração'; end if;
  if jsonb_array_length(coalesce(payload->'prices','[]'::jsonb)) <> 8
    or jsonb_array_length(coalesce(payload->'weights','[]'::jsonb)) <> 17
    or jsonb_array_length(coalesce(payload->'rates','[]'::jsonb)) <> 136
    or jsonb_array_length(coalesce(payload->'additional_kg_rates','[]'::jsonb)) <> 8
  then raise exception 'A matriz deve conter 8 faixas de preço, 17 de peso, 136 valores e 8 custos de kg adicional'; end if;

  select id into market from public.marketplaces where code='AMAZON' and active;
  select * into current_set from public.marketplace_shipping_rule_sets where marketplace_id=market and status='PUBLISHED' order by version desc limit 1;
  insert into public.marketplace_shipping_rule_sets(marketplace_id,version,status,effective_from,source_url,change_reason,created_by)
  values(market,coalesce(current_set.version,0)+1,'DRAFT',(payload->>'effective_from')::date,trim(payload->>'source_url'),trim(reason),(select auth.uid())) returning id into new_set;

  insert into public.shipping_price_bands(rule_set_id,label,max_price,sort_order)
  select new_set,x.label,x.max_price,x.sort_order from jsonb_to_recordset(payload->'prices') as x(label text,max_price numeric,sort_order int);
  insert into public.shipping_weight_bands(rule_set_id,label,max_weight_kg,sort_order)
  select new_set,x.label,x.max_weight_kg,x.sort_order from jsonb_to_recordset(payload->'weights') as x(label text,max_weight_kg numeric,sort_order int);
  if exists(select 1 from (select max_price,lag(max_price) over(order by sort_order) prev,sort_order from public.shipping_price_bands where rule_set_id=new_set) x where (sort_order<8 and max_price is null) or (sort_order>1 and max_price<=prev)) then raise exception 'Faixas de preço inválidas'; end if;
  if exists(select 1 from (select max_weight_kg,lag(max_weight_kg) over(order by sort_order) prev,sort_order from public.shipping_weight_bands where rule_set_id=new_set) x where max_weight_kg is null or (sort_order>1 and max_weight_kg<=prev)) then raise exception 'Faixas de peso inválidas'; end if;

  insert into public.shipping_rates(rule_set_id,price_band_id,weight_band_id,cost)
  select new_set,p.id,w.id,x.cost from jsonb_to_recordset(payload->'rates') as x(price_sort_order int,weight_sort_order int,cost numeric)
  join public.shipping_price_bands p on p.rule_set_id=new_set and p.sort_order=x.price_sort_order
  join public.shipping_weight_bands w on w.rule_set_id=new_set and w.sort_order=x.weight_sort_order where x.cost>=0;
  insert into public.shipping_additional_kg_rates(rule_set_id,price_band_id,cost_per_kg)
  select new_set,p.id,x.cost_per_kg from jsonb_to_recordset(payload->'additional_kg_rates') as x(price_sort_order int,cost_per_kg numeric)
  join public.shipping_price_bands p on p.rule_set_id=new_set and p.sort_order=x.price_sort_order where x.cost_per_kg>=0;
  if (select count(*) from public.shipping_rates where rule_set_id=new_set)<>136
    or (select count(*) from public.shipping_additional_kg_rates where rule_set_id=new_set)<>8
  then raise exception 'Valores de frete inválidos ou duplicados'; end if;

  update public.marketplace_shipping_rule_sets set status='ARCHIVED',effective_to=current_date where id=current_set.id;
  update public.marketplace_shipping_rule_sets set status='PUBLISHED' where id=new_set;
  insert into public.repricing_queue(product_id,marketplace_id,reason,source_type,source_id)
  select distinct c.product_id,market,'regra de frete da Amazon alterada','MARKETPLACE_SHIPPING_RULE',new_set
  from public.product_marketplace_configs c where c.marketplace_id=market and c.active
    and not exists(select 1 from public.repricing_queue q where q.product_id=c.product_id and q.marketplace_id=market and q.status in('OPEN','IN_PROGRESS'));
  return new_set;
end $$;
revoke all on function public.publish_amazon_shipping_rule(jsonb,text) from public,anon;
grant execute on function public.publish_amazon_shipping_rule(jsonb,text) to authenticated;
