create index if not exists marketplace_shipping_rule_sets_created_by_idx
  on public.marketplace_shipping_rule_sets (created_by);

create index if not exists shipping_rates_price_band_idx
  on public.shipping_rates (price_band_id);

create index if not exists shipping_rates_weight_band_idx
  on public.shipping_rates (weight_band_id);
