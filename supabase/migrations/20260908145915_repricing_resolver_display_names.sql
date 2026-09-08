-- Expose only display names needed to identify who concluded repricing items.
-- The profiles table remains protected by its existing RLS policies.

create or replace function public.profile_display_names(target_ids uuid[])
returns table(id uuid, display_name text)
language sql stable security definer set search_path = ''
as $$
  select profile.id, profile.display_name
  from public.profiles profile
  where (select auth.uid()) is not null
    and profile.id = any(target_ids);
$$;

revoke all on function public.profile_display_names(uuid[]) from public, anon;
grant execute on function public.profile_display_names(uuid[]) to authenticated;
