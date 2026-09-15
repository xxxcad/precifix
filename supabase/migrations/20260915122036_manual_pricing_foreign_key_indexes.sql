create index manual_pricing_calculations_marketplace_idx
  on public.manual_pricing_calculations (marketplace_id);

create index manual_pricing_calculations_fee_rule_idx
  on public.manual_pricing_calculations (fee_rule_set_id)
  where fee_rule_set_id is not null;

create index manual_pricing_calculations_calculation_rule_idx
  on public.manual_pricing_calculations (calculation_rule_version_id)
  where calculation_rule_version_id is not null;

create index manual_pricing_calculations_shipping_rule_idx
  on public.manual_pricing_calculations (shipping_rule_set_id)
  where shipping_rule_set_id is not null;
