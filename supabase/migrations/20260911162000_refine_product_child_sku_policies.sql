drop policy if exists internal_write_product_child_skus on public.product_child_skus;

create policy internal_insert_product_child_skus on public.product_child_skus
for insert to authenticated
with check (private.has_any_role(array['analyst','admin']));

create policy internal_update_product_child_skus on public.product_child_skus
for update to authenticated
using (private.has_any_role(array['analyst','admin']))
with check (private.has_any_role(array['analyst','admin']));

create policy internal_delete_product_child_skus on public.product_child_skus
for delete to authenticated
using (private.has_any_role(array['analyst','admin']));
