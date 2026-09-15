create index if not exists pricing_calculations_latest_scenario_idx
  on public.pricing_calculations (product_id, marketplace_id, listing_type, created_at desc);

create index if not exists pricing_calculations_selected_region_idx
  on public.pricing_calculations (product_id, marketplace_id, listing_type, ((rule_snapshot ->> 'selectedRegion')), created_at desc);
