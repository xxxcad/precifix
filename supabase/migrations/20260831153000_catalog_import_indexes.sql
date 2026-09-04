create index catalog_import_batches_created_by_idx
  on public.catalog_import_batches (created_by)
  where created_by is not null;
