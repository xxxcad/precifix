alter table public.products
  add column if not exists has_fixed_price boolean not null default false,
  add column if not exists fixed_price numeric(18, 6);

alter table public.products
  drop constraint if exists products_fixed_price_consistency;

alter table public.products
  add constraint products_fixed_price_consistency check (
    (has_fixed_price = false and fixed_price is null)
    or (has_fixed_price = true and fixed_price is not null and fixed_price > 0)
  );
