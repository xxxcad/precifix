alter table public.manual_pricing_calculations
  add column product_name text not null default 'Produto manual';

alter table public.manual_pricing_calculations
  add constraint manual_pricing_calculations_product_name_check
  check (char_length(btrim(product_name)) between 1 and 160);
