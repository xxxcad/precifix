create index fiscal_rules_updated_by_idx on public.fiscal_rules (updated_by) where updated_by is not null;
