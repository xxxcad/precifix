alter table public.products
  add column package_weight_kg numeric(12,4),
  add column package_height_cm numeric(12,2),
  add column package_width_cm numeric(12,2),
  add column package_length_cm numeric(12,2),
  add column cubic_weight_kg numeric(18,6) generated always as (
    case when package_height_cm is null then null
      else (package_height_cm * package_width_cm * package_length_cm) / 6000 end
  ) stored,
  add constraint products_packaging_complete check (
    (package_weight_kg is null and package_height_cm is null and package_width_cm is null and package_length_cm is null)
    or (package_weight_kg > 0 and package_height_cm > 0 and package_width_cm > 0 and package_length_cm > 0)
  );

create table public.marketplace_shipping_rule_sets (
  id uuid primary key default gen_random_uuid(),
  marketplace_id uuid not null references public.marketplaces(id),
  version integer not null check (version > 0),
  status text not null default 'PUBLISHED' check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  effective_from date not null default current_date,
  effective_to date,
  source_url text not null,
  change_reason text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (marketplace_id, version)
);

create table public.shipping_price_bands (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.marketplace_shipping_rule_sets(id) on delete cascade,
  label text not null,
  max_price numeric(18,2),
  sort_order integer not null check (sort_order > 0),
  unique (rule_set_id, sort_order)
);

create table public.shipping_weight_bands (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.marketplace_shipping_rule_sets(id) on delete cascade,
  label text not null,
  max_weight_kg numeric(12,4),
  sort_order integer not null check (sort_order > 0),
  unique (rule_set_id, sort_order)
);

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.marketplace_shipping_rule_sets(id) on delete cascade,
  price_band_id uuid not null references public.shipping_price_bands(id) on delete cascade,
  weight_band_id uuid not null references public.shipping_weight_bands(id) on delete cascade,
  cost numeric(18,2) not null check (cost >= 0),
  unique (rule_set_id, price_band_id, weight_band_id)
);

create index shipping_rule_lookup_idx on public.marketplace_shipping_rule_sets (marketplace_id, version desc) where status = 'PUBLISHED';
create index shipping_price_rule_idx on public.shipping_price_bands (rule_set_id, sort_order);
create index shipping_weight_rule_idx on public.shipping_weight_bands (rule_set_id, sort_order);
create index shipping_rates_rule_idx on public.shipping_rates (rule_set_id, weight_band_id, price_band_id);

alter table public.pricing_calculations add column shipping_rule_set_id uuid references public.marketplace_shipping_rule_sets(id);
create index pricing_calculations_shipping_rule_idx on public.pricing_calculations (shipping_rule_set_id) where shipping_rule_set_id is not null;

alter table public.marketplace_shipping_rule_sets enable row level security;
alter table public.shipping_price_bands enable row level security;
alter table public.shipping_weight_bands enable row level security;
alter table public.shipping_rates enable row level security;
revoke all on public.marketplace_shipping_rule_sets, public.shipping_price_bands, public.shipping_weight_bands, public.shipping_rates from anon, authenticated;
grant select on public.marketplace_shipping_rule_sets, public.shipping_price_bands, public.shipping_weight_bands, public.shipping_rates to authenticated;
grant insert, update on public.marketplace_shipping_rule_sets, public.shipping_price_bands, public.shipping_weight_bands, public.shipping_rates to authenticated;

create policy shipping_rule_read on public.marketplace_shipping_rule_sets for select to authenticated using ((select auth.uid()) is not null);
create policy shipping_price_read on public.shipping_price_bands for select to authenticated using ((select auth.uid()) is not null);
create policy shipping_weight_read on public.shipping_weight_bands for select to authenticated using ((select auth.uid()) is not null);
create policy shipping_rate_read on public.shipping_rates for select to authenticated using ((select auth.uid()) is not null);
create policy shipping_rule_admin_insert on public.marketplace_shipping_rule_sets for insert to authenticated with check (private.has_any_role(array['admin']));
create policy shipping_rule_admin_update on public.marketplace_shipping_rule_sets for update to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));
create policy shipping_price_admin_insert on public.shipping_price_bands for insert to authenticated with check (private.has_any_role(array['admin']));
create policy shipping_weight_admin_insert on public.shipping_weight_bands for insert to authenticated with check (private.has_any_role(array['admin']));
create policy shipping_rate_admin_insert on public.shipping_rates for insert to authenticated with check (private.has_any_role(array['admin']));

do $$
declare rs uuid;
begin
  insert into public.marketplace_shipping_rule_sets(marketplace_id,version,status,effective_from,source_url,change_reason)
  select id,1,'PUBLISHED',current_date,'https://www.mercadolivre.com.br/ajuda/40538','Tabela oficial inicial consultada em 03/09/2026'
  from public.marketplaces where code='MERCADO_LIVRE' returning id into rs;

  insert into public.shipping_price_bands(rule_set_id,label,max_price,sort_order) values
    (rs,'R$ 0 a R$ 18,99',18.99,1),(rs,'R$ 19 a R$ 48,99',48.99,2),(rs,'R$ 49 a R$ 78,99',78.99,3),(rs,'R$ 79 a R$ 99,99',99.99,4),
    (rs,'R$ 100 a R$ 119,99',119.99,5),(rs,'R$ 120 a R$ 149,99',149.99,6),(rs,'R$ 150 a R$ 199,99',199.99,7),(rs,'A partir de R$ 200',null,8);

  insert into public.shipping_weight_bands(rule_set_id,label,max_weight_kg,sort_order) values
    (rs,'Até 0,3 kg',0.3,1),(rs,'De 0,3 a 0,5 kg',0.5,2),(rs,'De 0,5 a 1 kg',1,3),(rs,'De 1 a 1,5 kg',1.5,4),(rs,'De 1,5 a 2 kg',2,5),
    (rs,'De 2 a 3 kg',3,6),(rs,'De 3 a 4 kg',4,7),(rs,'De 4 a 5 kg',5,8),(rs,'De 5 a 6 kg',6,9),(rs,'De 6 a 7 kg',7,10),
    (rs,'De 7 a 8 kg',8,11),(rs,'De 8 a 9 kg',9,12),(rs,'De 9 a 10 kg',10,13),(rs,'De 10 a 11 kg',11,14),(rs,'De 11 a 13 kg',13,15),
    (rs,'De 13 a 15 kg',15,16),(rs,'De 15 a 17 kg',17,17),(rs,'De 17 a 20 kg',20,18),(rs,'De 20 a 25 kg',25,19),(rs,'De 25 a 30 kg',30,20),
    (rs,'De 30 a 40 kg',40,21),(rs,'De 40 a 50 kg',50,22),(rs,'De 50 a 60 kg',60,23),(rs,'De 60 a 70 kg',70,24),(rs,'De 70 a 80 kg',80,25),
    (rs,'De 80 a 90 kg',90,26),(rs,'De 90 a 100 kg',100,27),(rs,'De 100 a 125 kg',125,28),(rs,'De 125 a 150 kg',150,29),(rs,'Mais de 150 kg',null,30);

  with matrix(weight_sort,costs) as (values
    (1,array[5.65,6.85,8.15,12.95,14.95,16.95,19.05,21.65]::numeric[]),(2,array[5.95,6.95,8.25,13.85,16.15,18.15,20.45,23.25]::numeric[]),
    (3,array[6.05,7.15,8.45,14.45,16.85,19.05,21.35,24.45]::numeric[]),(4,array[6.15,7.35,8.65,14.75,17.15,19.45,21.75,25.45]::numeric[]),
    (5,array[6.25,7.45,8.75,15.05,17.65,19.85,22.25,25.55]::numeric[]),(6,array[6.35,8.65,9.15,16.45,19.15,21.65,24.35,27.05]::numeric[]),
    (7,array[6.45,8.75,9.75,17.85,20.75,23.35,26.35,29.25]::numeric[]),(8,array[6.55,8.85,10.25,19.75,22.85,26.05,29.25,32.45]::numeric[]),
    (9,array[6.65,8.95,10.35,25.95,29.15,33.35,36.45,40.85]::numeric[]),(10,array[6.75,9.05,10.45,27.55,31.65,36.75,40.85,45.25]::numeric[]),
    (11,array[6.85,9.25,10.55,29.45,34.35,39.25,44.15,49.35]::numeric[]),(12,array[6.95,9.35,10.65,30.25,35.25,40.35,45.35,50.75]::numeric[]),
    (13,array[7.05,9.45,10.85,38.25,45.05,51.95,58.75,65.85]::numeric[]),(14,array[7.05,9.65,11.05,41.65,48.55,55.45,62.35,69.35]::numeric[]),
    (15,array[7.15,10.05,11.45,42.55,49.75,56.85,63.85,70.95]::numeric[]),(16,array[7.25,10.25,11.65,45.55,52.95,60.55,68.15,75.65]::numeric[]),
    (17,array[7.35,10.45,11.85,48.95,56.55,64.05,71.35,79.35]::numeric[]),(18,array[7.45,10.65,12.05,55.15,64.35,73.55,82.75,91.95]::numeric[]),
    (19,array[7.65,11.05,12.25,64.55,75.75,85.45,96.25,106.85]::numeric[]),(20,array[7.75,11.25,12.45,66.45,76.05,86.25,97.15,107.85]::numeric[]),
    (21,array[7.85,11.45,12.65,68.35,79.65,89.75,100.05,107.95]::numeric[]),(22,array[7.95,11.65,12.85,70.95,81.85,92.85,103.45,111.65]::numeric[]),
    (23,array[8.05,11.85,13.05,75.55,87.25,99.05,110.25,119.05]::numeric[]),(24,array[8.15,12.05,13.25,80.95,93.75,105.95,118.05,127.45]::numeric[]),
    (25,array[8.25,12.25,13.45,84.65,97.95,110.75,123.35,133.15]::numeric[]),(26,array[8.35,12.45,13.65,94.05,108.35,122.95,136.95,147.85]::numeric[]),
    (27,array[8.45,12.65,13.85,107.45,124.85,140.45,156.45,168.85]::numeric[]),(28,array[8.55,12.85,14.05,120.15,138.95,156.95,174.85,188.85]::numeric[]),
    (29,array[8.65,12.85,14.25,127.45,147.05,166.55,185.55,200.35]::numeric[]),(30,array[8.75,12.85,14.45,167.05,193.35,218.45,243.45,262.85]::numeric[])
  )
  insert into public.shipping_rates(rule_set_id,price_band_id,weight_band_id,cost)
  select rs,p.id,w.id,m.costs[p.sort_order]
  from matrix m join public.shipping_weight_bands w on w.rule_set_id=rs and w.sort_order=m.weight_sort
  cross join public.shipping_price_bands p where p.rule_set_id=rs;
end $$;

create or replace function public.publish_ml_shipping_rule(payload jsonb, reason text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare market uuid; current_set public.marketplace_shipping_rule_sets; new_set uuid; price_count int; weight_count int; rate_count int;
begin
  if not private.has_any_role(array['admin']) then raise exception 'Somente administradores podem publicar regras de frete'; end if;
  if length(trim(reason)) < 5 then raise exception 'Informe o motivo da alteração'; end if;
  select id into market from public.marketplaces where code='MERCADO_LIVRE' and active;
  select * into current_set from public.marketplace_shipping_rule_sets where marketplace_id=market and status='PUBLISHED' order by version desc limit 1;
  price_count := jsonb_array_length(coalesce(payload->'prices','[]'::jsonb)); weight_count := jsonb_array_length(coalesce(payload->'weights','[]'::jsonb)); rate_count := jsonb_array_length(coalesce(payload->'rates','[]'::jsonb));
  if price_count <> 8 or weight_count <> 30 or rate_count <> 240 then raise exception 'A matriz deve conter 8 faixas de preço, 30 de peso e 240 valores'; end if;
  insert into public.marketplace_shipping_rule_sets(marketplace_id,version,status,effective_from,source_url,change_reason,created_by)
  values(market,coalesce(current_set.version,0)+1,'DRAFT',current_date,'https://www.mercadolivre.com.br/ajuda/40538',trim(reason),(select auth.uid())) returning id into new_set;
  insert into public.shipping_price_bands(rule_set_id,label,max_price,sort_order)
  select new_set,x.label,x.max_price,x.sort_order from jsonb_to_recordset(payload->'prices') as x(label text,max_price numeric,sort_order int);
  insert into public.shipping_weight_bands(rule_set_id,label,max_weight_kg,sort_order)
  select new_set,x.label,x.max_weight_kg,x.sort_order from jsonb_to_recordset(payload->'weights') as x(label text,max_weight_kg numeric,sort_order int);
  if exists(select 1 from (select max_price,lag(max_price) over(order by sort_order) prev,sort_order from public.shipping_price_bands where rule_set_id=new_set) x where (sort_order<8 and max_price is null) or (sort_order>1 and max_price<=prev)) then raise exception 'Faixas de preço inválidas'; end if;
  if exists(select 1 from (select max_weight_kg,lag(max_weight_kg) over(order by sort_order) prev,sort_order from public.shipping_weight_bands where rule_set_id=new_set) x where (sort_order<30 and max_weight_kg is null) or (sort_order>1 and max_weight_kg<=prev)) then raise exception 'Faixas de peso inválidas'; end if;
  insert into public.shipping_rates(rule_set_id,price_band_id,weight_band_id,cost)
  select new_set,p.id,w.id,x.cost from jsonb_to_recordset(payload->'rates') as x(price_sort int,weight_sort int,cost numeric)
  join public.shipping_price_bands p on p.rule_set_id=new_set and p.sort_order=x.price_sort
  join public.shipping_weight_bands w on w.rule_set_id=new_set and w.sort_order=x.weight_sort where x.cost>=0;
  if (select count(*) from public.shipping_rates where rule_set_id=new_set)<>240 then raise exception 'Valores de frete inválidos ou duplicados'; end if;
  update public.marketplace_shipping_rule_sets set status='ARCHIVED',effective_to=current_date where id=current_set.id;
  update public.marketplace_shipping_rule_sets set status='PUBLISHED' where id=new_set;
  insert into public.repricing_queue(product_id,marketplace_id,reason,source_type,source_id)
  select distinct c.product_id,market,'regra de frete do Mercado Livre alterada','MARKETPLACE_SHIPPING_RULE',new_set
  from public.product_marketplace_configs c where c.marketplace_id=market and c.active and not exists(select 1 from public.repricing_queue q where q.product_id=c.product_id and q.marketplace_id=market and q.status in('OPEN','IN_PROGRESS'));
  return new_set;
end $$;
revoke all on function public.publish_ml_shipping_rule(jsonb,text) from public,anon;
grant execute on function public.publish_ml_shipping_rule(jsonb,text) to authenticated;

create or replace function private.track_product_repricing()
returns trigger language plpgsql security definer set search_path='' as $$
declare reasons text[] := array[]::text[];
begin
  if old.cost is distinct from new.cost then
    insert into public.product_cost_history(product_id,old_cost,new_cost,changed_by) values(new.id,old.cost,new.cost,(select auth.uid()));
    reasons:=array_append(reasons,'custo alterado de R$ '||old.cost||' para R$ '||new.cost);
  end if;
  if old.fiscal_rule_id is distinct from new.fiscal_rule_id then reasons:=array_append(reasons,'regra fiscal alterada'); end if;
  if old.st_amount is distinct from new.st_amount or old.input_icms_rate is distinct from new.input_icms_rate or old.input_pis_rate is distinct from new.input_pis_rate or old.input_cofins_rate is distinct from new.input_cofins_rate or old.input_ipi_rate is distinct from new.input_ipi_rate or old.output_icms_sp_rate is distinct from new.output_icms_sp_rate or old.output_icms_south_southeast_rate is distinct from new.output_icms_south_southeast_rate or old.output_icms_north_northeast_rate is distinct from new.output_icms_north_northeast_rate then reasons:=array_append(reasons,'parâmetros fiscais alterados'); end if;
  if old.package_weight_kg is distinct from new.package_weight_kg or old.package_height_cm is distinct from new.package_height_cm or old.package_width_cm is distinct from new.package_width_cm or old.package_length_cm is distinct from new.package_length_cm then reasons:=array_append(reasons,'peso ou dimensões da embalagem alterados'); end if;
  if array_length(reasons,1)>0 then perform private.enqueue_repricing(new.id,null,array_to_string(reasons,'; '),'PRODUCT_CHANGE',new.id); end if;
  return new;
end $$;
revoke all on function private.track_product_repricing() from public,anon,authenticated;
