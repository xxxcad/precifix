drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_self_update on public.profiles;

create policy profiles_update
on public.profiles
for update
to authenticated
using (
  (id = (select auth.uid()) and active)
  or private.has_any_role(array['admin'])
)
with check (
  (id = (select auth.uid()) and active)
  or private.has_any_role(array['admin'])
);
