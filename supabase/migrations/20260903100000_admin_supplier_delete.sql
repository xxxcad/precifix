grant delete on public.suppliers to authenticated;

drop policy if exists admin_delete_suppliers on public.suppliers;
create policy admin_delete_suppliers
on public.suppliers
for delete
to authenticated
using (private.has_any_role(array['admin']));
