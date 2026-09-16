-- Every newly registered product needs an independent operational review in
-- each active marketplace. The existing enqueue helper expands a null channel
-- into one queue row per active marketplace in the same transaction.
create or replace function private.track_new_product_repricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_repricing(
    new.id,
    null,
    'Produto novo cadastrado. Realize a primeira precificação e cadastre o anúncio neste marketplace.',
    'PRODUCT_CHANGE',
    new.id
  );

  return new;
end;
$$;

revoke all on function private.track_new_product_repricing() from public, anon, authenticated;

drop trigger if exists track_new_product_repricing on public.products;
create trigger track_new_product_repricing
after insert on public.products
for each row
execute function private.track_new_product_repricing();
