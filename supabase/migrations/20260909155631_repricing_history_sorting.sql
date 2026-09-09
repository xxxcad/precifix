-- Track fixed-price changes independently and expand them to every active marketplace.
create or replace function private.track_fixed_price_repricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare queue_reason text;
begin
  queue_reason := case
    when old.has_fixed_price = false and new.has_fixed_price = true then
      'Preço tabelado ativado com valor ' || private.repricing_money(new.fixed_price) || '.'
    when old.has_fixed_price = true and new.has_fixed_price = false then
      'Preço tabelado desativado; valor anterior ' || private.repricing_money(old.fixed_price) || '.'
    else
      'Preço tabelado mudou de ' || private.repricing_money(old.fixed_price) || ' para ' || private.repricing_money(new.fixed_price) || '.'
  end;
  perform private.enqueue_repricing(new.id, null, queue_reason, 'PRODUCT_FIXED_PRICE_CHANGE', new.id);
  return new;
end;
$$;

revoke all on function private.track_fixed_price_repricing() from public, anon, authenticated;
drop trigger if exists track_fixed_price_repricing on public.products;
create trigger track_fixed_price_repricing
after update of has_fixed_price, fixed_price on public.products
for each row
when (old.has_fixed_price is distinct from new.has_fixed_price or old.fixed_price is distinct from new.fixed_price)
execute function private.track_fixed_price_repricing();

-- A single, allowlisted read API keeps filtering, ordering and pagination in Postgres.
create or replace function public.list_operational_history(
  p_kind text,
  p_query text default '',
  p_channel text default '',
  p_page integer default 1,
  p_page_size integer default 20,
  p_sort text default 'date',
  p_direction text default 'desc'
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payload jsonb;
  sort_expression text;
  safe_direction text := case when lower(p_direction) = 'asc' then 'asc' else 'desc' end;
  safe_limit integer := least(20, greatest(1, coalesce(p_page_size, 20)));
  safe_offset integer := (greatest(1, coalesce(p_page, 1)) - 1) * least(20, greatest(1, coalesce(p_page_size, 20)));
  statement text;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles where id = (select auth.uid()) and active
  ) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  if p_kind = 'cost' then
    sort_expression := case p_sort
      when 'product' then 'sku'
      when 'oldCost' then 'old_cost'
      when 'newCost' then 'new_cost'
      when 'difference' then 'cost_difference'
      when 'changedBy' then 'changed_by_name'
      else 'changed_at'
    end;
    statement := format($query$
      with filtered as materialized (
        select h.id, h.changed_at, p.sku, p.name as product_name,
          h.old_cost, h.new_cost, h.new_cost - h.old_cost as cost_difference,
          case when h.old_cost = 0 then null else ((h.new_cost - h.old_cost) / h.old_cost) end as difference_percent,
          coalesce(pr.display_name, 'Sistema') as changed_by_name
        from public.product_cost_history h
        join public.products p on p.id = h.product_id
        left join public.profiles pr on pr.id = h.changed_by
        where nullif(trim($1), '') is null or p.sku ilike '%%' || trim($1) || '%%' or p.name ilike '%%' || trim($1) || '%%'
      ), paged as (
        select * from filtered order by %s %s, id %s limit $2 offset $3
      )
      select jsonb_build_object('total', (select count(*) from filtered), 'items', coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb))
    $query$, sort_expression, safe_direction, safe_direction);
    execute statement into payload using p_query, safe_limit, safe_offset;

  elsif p_kind = 'products' then
    sort_expression := case p_sort
      when 'product' then 'sku'
      when 'supplier' then 'supplier_name'
      when 'status' then 'active'
      else 'created_at'
    end;
    statement := format($query$
      with filtered as materialized (
        select p.id, p.created_at, p.sku, p.name as product_name, s.name as supplier_name, p.active
        from public.products p join public.suppliers s on s.id = p.supplier_id
        where nullif(trim($1), '') is null or p.sku ilike '%%' || trim($1) || '%%' or p.name ilike '%%' || trim($1) || '%%'
      ), paged as (
        select * from filtered order by %s %s, id %s limit $2 offset $3
      )
      select jsonb_build_object('total', (select count(*) from filtered), 'items', coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb))
    $query$, sort_expression, safe_direction, safe_direction);
    execute statement into payload using p_query, safe_limit, safe_offset;

  elsif p_kind = 'pricing' then
    sort_expression := case p_sort
      when 'product' then 'sku'
      when 'marketplace' then 'marketplace_name'
      when 'price' then 'sale_price'
      when 'shipping' then 'shipping_cost'
      when 'margin' then 'margin_percent'
      else 'created_at'
    end;
    statement := format($query$
      with filtered as materialized (
        select pc.id, pc.created_at, p.sku, p.name as product_name, m.name as marketplace_name,
          pc.listing_type, pc.sale_price, pc.shipping_cost,
          coalesce((pc.results -> coalesce(pc.rule_snapshot ->> 'selectedRegion', 'SP') ->> 'contributionMarginValue')::numeric, 0) as margin_value,
          coalesce((pc.results -> coalesce(pc.rule_snapshot ->> 'selectedRegion', 'SP') ->> 'contributionMarginPercent')::numeric, 0) as margin_percent
        from public.pricing_calculations pc
        join public.products p on p.id = pc.product_id
        join public.marketplaces m on m.id = pc.marketplace_id
        where nullif(trim($1), '') is null or p.sku ilike '%%' || trim($1) || '%%' or p.name ilike '%%' || trim($1) || '%%'
      ), paged as (
        select * from filtered order by %s %s, id %s limit $2 offset $3
      )
      select jsonb_build_object('total', (select count(*) from filtered), 'items', coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb))
    $query$, sort_expression, safe_direction, safe_direction);
    execute statement into payload using p_query, safe_limit, safe_offset;

  elsif p_kind in ('repricing_pending', 'repricing_completed') then
    sort_expression := case p_sort
      when 'product' then 'sku'
      when 'channel' then 'marketplace_name'
      when 'type' then 'type_label'
      when 'reason' then 'reason'
      when 'result' then 'resolved_by_name'
      else case when p_kind = 'repricing_completed' then 'resolved_at' else 'created_at' end
    end;
    statement := format($query$
      with filtered as materialized (
        select q.id, q.product_id, q.created_at, q.resolved_at, q.status, q.reason, q.source_type,
          p.sku, p.name as product_name, p.cost, s.name as supplier_name,
          coalesce(m.name, 'Todos') as marketplace_name,
          coalesce(pr.display_name, 'Usuário não identificado') as resolved_by_name,
          case
            when q.source_type in ('PRODUCT_COST_CHANGE') then 'Custo'
            when q.source_type = 'PRODUCT_FIXED_PRICE_CHANGE' then 'Preço tabelado'
            when q.source_type in ('PRODUCT_FISCAL_RULE_CHANGE','PRODUCT_TAX_CHANGE','FISCAL_RULE_CHANGE') then 'Fiscal'
            when q.source_type in ('PRODUCT_MARKETPLACE_COMMISSION_CHANGE','PRODUCT_MARKETPLACE_FIXED_FEE_CHANGE','PRODUCT_MARKETPLACE_LISTING_CHANGE','PRODUCT_MARKETPLACE_CHANGE','MARKETPLACE_CHANGE','MARKETPLACE_FEE_BAND_CHANGE','MARKETPLACE_FEE_RULE_CHANGE') then 'Comissão/Tarifa'
            when q.source_type in ('PRODUCT_MARKETPLACE_FREIGHT_CHANGE','PRODUCT_PACKAGING_CHANGE','MARKETPLACE_SHIPPING_RULE') then 'Frete/Embalagem'
            when q.source_type = 'PRODUCT_CHANGE' and lower(q.reason) similar to '%(frete|peso|altura|largura|comprimento|dimens|embalagem|cubagem)%' then 'Frete/Embalagem'
            when q.source_type = 'PRODUCT_CHANGE' and lower(q.reason) similar to '%(custo)%' then 'Custo'
            when q.source_type = 'PRODUCT_CHANGE' and lower(q.reason) similar to '%(fiscal|icms|pis|cofins|ipi|st )%' then 'Fiscal'
            when q.source_type = 'PRODUCT_CHANGE' then 'Cadastro/Status'
            else 'Outros'
          end as type_label
        from public.repricing_queue q
        join public.products p on p.id = q.product_id
        join public.suppliers s on s.id = p.supplier_id
        left join public.marketplaces m on m.id = q.marketplace_id
        left join public.profiles pr on pr.id = q.resolved_by
        where (($1 = 'repricing_pending' and q.status in ('OPEN','IN_PROGRESS')) or ($1 = 'repricing_completed' and q.status in ('RESOLVED','DISMISSED')))
          and (nullif(trim($2), '') is null or m.name = $2)
      ), paged as (
        select * from filtered order by %s %s, id %s limit $3 offset $4
      )
      select jsonb_build_object('total', (select count(*) from filtered), 'items', coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb))
    $query$, sort_expression, safe_direction, safe_direction);
    execute statement into payload using p_kind, p_channel, safe_limit, safe_offset;
  else
    raise exception 'Tipo de listagem inválido' using errcode = '22023';
  end if;

  return payload;
end;
$$;

revoke all on function public.list_operational_history(text,text,text,integer,integer,text,text) from public, anon;
grant execute on function public.list_operational_history(text,text,text,integer,integer,text,text) to authenticated;
