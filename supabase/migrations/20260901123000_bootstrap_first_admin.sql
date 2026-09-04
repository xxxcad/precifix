create table private.admin_bootstrap_allowlist (
  email text primary key,
  claimed_at timestamptz,
  user_id uuid references auth.users(id)
);
revoke all on private.admin_bootstrap_allowlist from public, anon, authenticated;

insert into private.admin_bootstrap_allowlist(email)
values ('hannoverhome4@gmail.com')
on conflict (email) do nothing;

create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare bootstrap_admin boolean;
begin
  select exists (
    select 1 from private.admin_bootstrap_allowlist
    where email = lower(new.email) and claimed_at is null
  ) into bootstrap_admin;

  insert into public.profiles(id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case when bootstrap_admin then 'admin' else 'viewer' end
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    role = case when bootstrap_admin then 'admin' else public.profiles.role end,
    updated_at = now();

  if bootstrap_admin then
    update private.admin_bootstrap_allowlist
    set claimed_at = now(), user_id = new.id
    where email = lower(new.email) and claimed_at is null;
  end if;
  return new;
end;
$$;
revoke all on function private.create_profile_for_new_user() from public;
