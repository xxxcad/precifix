-- Premium starts five percentage points above each product's imported Classic
-- commission. Missing source commissions remain null for manual completion.
insert into public.product_marketplace_configs
  (product_id, marketplace_id, listing_type, commission_rate_override, current_sale_price, freight_cost, active)
select classic.product_id, classic.marketplace_id, 'PREMIUM',
       case when classic.commission_rate_override is null then null
            else least(classic.commission_rate_override + 0.05, 1) end,
       classic.current_sale_price, classic.freight_cost, classic.active
from public.product_marketplace_configs classic
join public.marketplaces marketplace on marketplace.id = classic.marketplace_id
where marketplace.code = 'MERCADO_LIVRE'
  and classic.listing_type = 'CLASSICO'
on conflict (product_id, marketplace_id, listing_type)
do update set commission_rate_override = excluded.commission_rate_override;
