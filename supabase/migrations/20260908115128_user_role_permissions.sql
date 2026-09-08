-- Align catalog and repricing permissions with the application roles.
-- RLS remains enabled; only the affected policies are replaced.

drop policy if exists admin_delete_products on public.products;
create policy analyst_delete_products on public.products
for delete to authenticated
using (private.has_any_role(array['analyst','admin']));

drop policy if exists admin_delete_suppliers on public.suppliers;
create policy analyst_delete_suppliers on public.suppliers
for delete to authenticated
using (private.has_any_role(array['analyst','admin']));

drop policy if exists analyst_update_queue on public.repricing_queue;
create policy internal_update_queue on public.repricing_queue
for update to authenticated
using (private.has_any_role(array['viewer','analyst','admin']))
with check (private.has_any_role(array['viewer','analyst','admin']));
