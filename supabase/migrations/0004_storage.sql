-- Storage bucket for request screenshots

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set file_size_limit = 1048576,
      allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'],
      public = false;

-- Path convention: {auth.uid()}/{filename}. The leading folder segment is the
-- owner's uid, so (storage.foldername(name))[1] gives ownership for policies.

drop policy if exists screenshots_insert_own_folder on storage.objects;
create policy screenshots_insert_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists screenshots_select_own_or_staff on storage.objects;
create policy screenshots_select_own_or_staff on storage.objects
  for select to authenticated
  using (
    bucket_id = 'screenshots'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_staff())
  );

-- No update/delete policy for clients: own uploads are immutable once submitted.
drop policy if exists screenshots_delete_staff on storage.objects;
create policy screenshots_delete_staff on storage.objects
  for delete to authenticated
  using (bucket_id = 'screenshots' and is_staff());
