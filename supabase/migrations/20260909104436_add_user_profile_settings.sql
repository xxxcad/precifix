alter table public.profiles
  add column if not exists avatar_path text;

grant update (display_name, avatar_path) on public.profiles to authenticated;

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles
for update
to authenticated
using (id = (select auth.uid()) and active)
with check (id = (select auth.uid()) and active);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-avatars',
  'user-avatars',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists user_avatars_self_read on storage.objects;
create policy user_avatars_self_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists user_avatars_self_insert on storage.objects;
create policy user_avatars_self_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists user_avatars_self_update on storage.objects;
create policy user_avatars_self_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists user_avatars_self_delete on storage.objects;
create policy user_avatars_self_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
