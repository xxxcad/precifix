create table public.catalog_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,
  source_sha256 text not null,
  importer_version text not null,
  status text not null default 'STAGED' check (status in ('STAGED','IMPORTED','PARTIAL','FAILED')),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (source_sha256, importer_version)
);

create table public.product_sources (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  import_batch_id uuid not null references public.catalog_import_batches(id) on delete cascade,
  source_sheet text not null,
  source_row integer not null check (source_row > 0),
  source_payload jsonb not null,
  imported_at timestamptz not null default now(),
  unique (import_batch_id, source_sheet, source_row)
);

create table public.catalog_import_issues (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.catalog_import_batches(id) on delete cascade,
  source_sheet text not null,
  source_row integer,
  sku text,
  code text not null,
  detail text not null,
  raw_data jsonb,
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED','DISMISSED')),
  resolution_notes text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'OPEN' and resolved_at is null and resolved_by is null)
    or (status in ('RESOLVED','DISMISSED') and resolved_at is not null)
  )
);

create index product_sources_product_idx on public.product_sources (product_id, imported_at desc);
create index catalog_import_issues_open_idx on public.catalog_import_issues (created_at desc) where status = 'OPEN';
create index catalog_import_issues_batch_idx on public.catalog_import_issues (import_batch_id, code);
create index catalog_import_issues_resolved_by_idx on public.catalog_import_issues (resolved_by) where resolved_by is not null;

alter table public.catalog_import_batches enable row level security;
alter table public.product_sources enable row level security;
alter table public.catalog_import_issues enable row level security;

revoke all on public.catalog_import_batches, public.product_sources, public.catalog_import_issues from anon, authenticated;
grant select on public.catalog_import_batches, public.product_sources, public.catalog_import_issues to authenticated;
grant insert on public.catalog_import_batches, public.product_sources, public.catalog_import_issues to authenticated;
grant update on public.catalog_import_batches, public.catalog_import_issues to authenticated;

create policy internal_read_import_batches on public.catalog_import_batches
  for select to authenticated using ((select auth.uid()) is not null);
create policy analyst_insert_import_batches on public.catalog_import_batches
  for insert to authenticated with check (private.has_any_role(array['analyst','admin']));
create policy analyst_update_import_batches on public.catalog_import_batches
  for update to authenticated using (private.has_any_role(array['analyst','admin']))
  with check (private.has_any_role(array['analyst','admin']));

create policy internal_read_product_sources on public.product_sources
  for select to authenticated using (private.has_any_role(array['analyst','admin']));
create policy analyst_insert_product_sources on public.product_sources
  for insert to authenticated with check (private.has_any_role(array['analyst','admin']));

create policy internal_read_import_issues on public.catalog_import_issues
  for select to authenticated using (private.has_any_role(array['analyst','admin']));
create policy analyst_insert_import_issues on public.catalog_import_issues
  for insert to authenticated with check (private.has_any_role(array['analyst','admin']));
create policy analyst_update_import_issues on public.catalog_import_issues
  for update to authenticated using (private.has_any_role(array['analyst','admin']))
  with check (private.has_any_role(array['analyst','admin']));
