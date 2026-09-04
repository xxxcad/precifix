drop policy internal_write_suppliers on public.suppliers;
drop policy internal_write_products on public.products;
drop policy internal_write_product_configs on public.product_marketplace_configs;
drop policy admin_write_marketplaces on public.marketplaces;
drop policy admin_write_fiscal_rules on public.fiscal_rules;
drop policy admin_write_fee_sets on public.marketplace_fee_rule_sets;
drop policy admin_write_fee_bands on public.marketplace_fee_bands;
drop policy admin_write_calculation_rules on public.calculation_rule_versions;
drop policy admin_write_classifications on public.margin_classifications;
drop policy analyst_write_queue on public.repricing_queue;

create policy analyst_insert_suppliers on public.suppliers for insert to authenticated with check (private.has_any_role(array['analyst','admin']));
create policy analyst_update_suppliers on public.suppliers for update to authenticated using (private.has_any_role(array['analyst','admin'])) with check (private.has_any_role(array['analyst','admin']));
create policy analyst_insert_products on public.products for insert to authenticated with check (private.has_any_role(array['analyst','admin']));
create policy analyst_update_products on public.products for update to authenticated using (private.has_any_role(array['analyst','admin'])) with check (private.has_any_role(array['analyst','admin']));
create policy analyst_insert_product_configs on public.product_marketplace_configs for insert to authenticated with check (private.has_any_role(array['analyst','admin']));
create policy analyst_update_product_configs on public.product_marketplace_configs for update to authenticated using (private.has_any_role(array['analyst','admin'])) with check (private.has_any_role(array['analyst','admin']));

create policy admin_insert_marketplaces on public.marketplaces for insert to authenticated with check (private.has_any_role(array['admin']));
create policy admin_update_marketplaces on public.marketplaces for update to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));
create policy admin_insert_fiscal_rules on public.fiscal_rules for insert to authenticated with check (private.has_any_role(array['admin']));
create policy admin_update_fiscal_rules on public.fiscal_rules for update to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));
create policy admin_insert_fee_sets on public.marketplace_fee_rule_sets for insert to authenticated with check (private.has_any_role(array['admin']));
create policy admin_update_fee_sets on public.marketplace_fee_rule_sets for update to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));
create policy admin_insert_fee_bands on public.marketplace_fee_bands for insert to authenticated with check (private.has_any_role(array['admin']));
create policy admin_update_fee_bands on public.marketplace_fee_bands for update to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));
create policy admin_insert_calculation_rules on public.calculation_rule_versions for insert to authenticated with check (private.has_any_role(array['admin']));
create policy admin_update_calculation_rules on public.calculation_rule_versions for update to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));
create policy admin_insert_classifications on public.margin_classifications for insert to authenticated with check (private.has_any_role(array['admin']));
create policy admin_update_classifications on public.margin_classifications for update to authenticated using (private.has_any_role(array['admin'])) with check (private.has_any_role(array['admin']));

create policy analyst_insert_queue on public.repricing_queue for insert to authenticated with check (private.has_any_role(array['analyst','admin']));
create policy analyst_update_queue on public.repricing_queue for update to authenticated using (private.has_any_role(array['analyst','admin'])) with check (private.has_any_role(array['analyst','admin']));

create index audit_logs_changed_by_idx on public.audit_logs (changed_by) where changed_by is not null;
create index calculation_rule_versions_created_by_idx on public.calculation_rule_versions (created_by) where created_by is not null;
create index margin_classifications_created_by_idx on public.margin_classifications (created_by) where created_by is not null;
create index fee_rule_sets_created_by_idx on public.marketplace_fee_rule_sets (created_by) where created_by is not null;
create index marketplaces_updated_by_idx on public.marketplaces (updated_by) where updated_by is not null;
create index pricing_calculations_rule_version_idx on public.pricing_calculations (calculation_rule_version_id) where calculation_rule_version_id is not null;
create index pricing_calculations_created_by_idx on public.pricing_calculations (created_by, created_at desc);
create index pricing_calculations_fee_rule_set_idx on public.pricing_calculations (fee_rule_set_id) where fee_rule_set_id is not null;
create index product_marketplace_marketplace_idx on public.product_marketplace_configs (marketplace_id) where active;
create index product_marketplace_updated_by_idx on public.product_marketplace_configs (updated_by) where updated_by is not null;
create index products_updated_by_idx on public.products (updated_by) where updated_by is not null;
create index repricing_queue_marketplace_idx on public.repricing_queue (marketplace_id) where marketplace_id is not null;
create index repricing_queue_product_idx on public.repricing_queue (product_id, created_at desc);
create index repricing_queue_resolved_by_idx on public.repricing_queue (resolved_by) where resolved_by is not null;
create index suppliers_updated_by_idx on public.suppliers (updated_by) where updated_by is not null;
