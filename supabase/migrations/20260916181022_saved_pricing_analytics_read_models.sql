create index if not exists pricing_calculations_product_creator_created_idx
  on public.pricing_calculations (product_id, created_by, created_at desc);

create or replace function public.pricing_scenario_key(p_marketplace_code text, p_listing_type text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_marketplace_code = 'MERCADO_LIVRE' and p_listing_type = 'PREMIUM' then 'ML_PREMIUM'
    when p_marketplace_code = 'MERCADO_LIVRE' then 'ML_CLASSICO'
    when p_marketplace_code = 'SHOPEE' then 'SHOPEE'
    when p_marketplace_code = 'AMAZON' then 'AMAZON'
    else null
  end;
$$;

create or replace function public.list_saved_pricing_latest(
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
  p_scenario text default null
)
returns table (
  product_id uuid,
  calculation_id uuid,
  scenario text,
  marketplace_id uuid,
  listing_type text,
  created_by uuid,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (pc.product_id, scenario_value.scenario)
    pc.product_id,
    pc.id,
    scenario_value.scenario,
    pc.marketplace_id,
    pc.listing_type,
    pc.created_by,
    pc.created_at
  from public.pricing_calculations pc
  join public.marketplaces marketplace on marketplace.id = pc.marketplace_id
  cross join lateral (
    select public.pricing_scenario_key(marketplace.code, pc.listing_type) as scenario
  ) scenario_value
  where scenario_value.scenario is not null
    and (p_created_from is null or pc.created_at >= p_created_from)
    and (p_created_to is null or pc.created_at <= p_created_to)
    and (p_scenario is null or scenario_value.scenario = p_scenario)
  order by pc.product_id, scenario_value.scenario, pc.created_at desc, pc.id desc;
$$;

create or replace function public.list_product_pricing_history(
  p_product_id uuid,
  p_page integer default 1,
  p_page_size integer default 20,
  p_scenario text default null,
  p_region text default null,
  p_created_by uuid default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
  p_sort text default 'date',
  p_direction text default 'desc'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  safe_page integer := greatest(coalesce(p_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  safe_sort text := case when p_sort in ('date', 'channel', 'price', 'shipping', 'marginValue', 'marginPercent', 'creator') then p_sort else 'date' end;
  safe_direction text := case when lower(p_direction) = 'asc' then 'asc' else 'desc' end;
  result jsonb;
begin
  with filtered as (
    select
      pc.id,
      pc.created_at,
      pc.created_by,
      pc.marketplace_id,
      marketplace.name as marketplace_name,
      public.pricing_scenario_key(marketplace.code, pc.listing_type) as scenario,
      pc.listing_type,
      pc.sale_price,
      pc.shipping_cost,
      pc.results,
      pc.input_snapshot,
      pc.rule_snapshot,
      coalesce(pc.rule_snapshot ->> 'selectedRegion', 'SP') as selected_region,
      coalesce((pc.results -> coalesce(nullif(p_region, ''), coalesce(pc.rule_snapshot ->> 'selectedRegion', 'SP')) ->> 'contributionMarginValue')::numeric, 0) as margin_value,
      coalesce((pc.results -> coalesce(nullif(p_region, ''), coalesce(pc.rule_snapshot ->> 'selectedRegion', 'SP')) ->> 'contributionMarginPercent')::numeric, 0) as margin_percent
    from public.pricing_calculations pc
    join public.marketplaces marketplace on marketplace.id = pc.marketplace_id
    where pc.product_id = p_product_id
      and (p_scenario is null or public.pricing_scenario_key(marketplace.code, pc.listing_type) = p_scenario)
      and (p_region is null or coalesce(pc.rule_snapshot ->> 'selectedRegion', 'SP') = p_region)
      and (p_created_by is null or pc.created_by = p_created_by)
      and (p_created_from is null or pc.created_at >= p_created_from)
      and (p_created_to is null or pc.created_at <= p_created_to)
  ), ordered as (
    select *
    from filtered
    order by
      case when safe_sort = 'date' and safe_direction = 'asc' then created_at end asc,
      case when safe_sort = 'date' and safe_direction = 'desc' then created_at end desc,
      case when safe_sort = 'channel' and safe_direction = 'asc' then marketplace_name || listing_type end asc,
      case when safe_sort = 'channel' and safe_direction = 'desc' then marketplace_name || listing_type end desc,
      case when safe_sort = 'price' and safe_direction = 'asc' then sale_price end asc,
      case when safe_sort = 'price' and safe_direction = 'desc' then sale_price end desc,
      case when safe_sort = 'shipping' and safe_direction = 'asc' then shipping_cost end asc,
      case when safe_sort = 'shipping' and safe_direction = 'desc' then shipping_cost end desc,
      case when safe_sort = 'marginValue' and safe_direction = 'asc' then margin_value end asc,
      case when safe_sort = 'marginValue' and safe_direction = 'desc' then margin_value end desc,
      case when safe_sort = 'marginPercent' and safe_direction = 'asc' then margin_percent end asc,
      case when safe_sort = 'marginPercent' and safe_direction = 'desc' then margin_percent end desc,
      case when safe_sort = 'creator' and safe_direction = 'asc' then created_by end asc,
      case when safe_sort = 'creator' and safe_direction = 'desc' then created_by end desc,
      created_at desc,
      id desc
  ), paged as (
    select * from ordered offset (safe_page - 1) * safe_page_size limit safe_page_size
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.pricing_scenario_key(text, text) from public, anon;
revoke all on function public.list_saved_pricing_latest(timestamptz, timestamptz, text) from public, anon;
revoke all on function public.list_product_pricing_history(uuid, integer, integer, text, text, uuid, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.pricing_scenario_key(text, text) to authenticated;
grant execute on function public.list_saved_pricing_latest(timestamptz, timestamptz, text) to authenticated;
grant execute on function public.list_product_pricing_history(uuid, integer, integer, text, text, uuid, timestamptz, timestamptz, text, text) to authenticated;
