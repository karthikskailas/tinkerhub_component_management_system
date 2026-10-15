-- Student-submitted return: the borrower names who received the components
-- and uploads a photo. Changes NO stock and NO status; the request stays
-- `issued` until staff run verify_return (unchanged, no submission needed).

alter table requests
  add column if not exists return_submitted_at timestamptz,
  add column if not exists return_receiver_staff_id uuid references handover_staff (id),
  add column if not exists return_receiver_name text,
  add column if not exists return_receiver_designation text,
  add column if not exists return_photo_path text,
  add column if not exists return_note text;

-- ============================================================
-- Storage: private bucket, path {auth.uid()}/{filename}
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('return-photos', 'return-photos', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set file_size_limit = 1048576,
      allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'],
      public = false;

drop policy if exists return_photos_insert_own_folder on storage.objects;
create policy return_photos_insert_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'return-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists return_photos_select_own_or_staff on storage.objects;
create policy return_photos_select_own_or_staff on storage.objects
  for select to authenticated
  using (
    bucket_id = 'return-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );

-- No client update/delete policy: uploads are immutable once made.
drop policy if exists return_photos_delete_staff on storage.objects;
create policy return_photos_delete_staff on storage.objects
  for delete to authenticated
  using (bucket_id = 'return-photos' and public.is_staff());

-- ============================================================
-- list_handover_staff_public: id, name, designation of active staff only
-- ============================================================
create or replace function list_handover_staff_public()
returns table (id uuid, name text, designation text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_rate_limit('handover_staff_public', 60, 10);
  return query
    select s.id, s.name, s.designation
    from public.handover_staff s
    where s.active
    order by s.name;
end;
$$;

-- ============================================================
-- Shared implementation (not granted to anyone)
-- ============================================================
create or replace function _submit_return(
  p_request_id uuid,
  p_token text,
  p_photo_path text,
  p_receiver_staff_id uuid,
  p_receiver_name text,
  p_receiver_designation text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.requests%rowtype;
  v_name text;
  v_designation text;
  v_snapshot text;
  v_in_name text := trim(coalesce(p_receiver_name, ''));
  v_in_designation text := trim(coalesce(p_receiver_designation, ''));
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_now timestamptz := now();
begin
  perform public.check_rate_limit('return_submit', 20, 10);

  if auth.uid() is null then
    raise exception 'E_FORBIDDEN: sign in required' using errcode = 'P0001';
  end if;

  if p_token is not null then
    select * into v_r from public.requests where public_token = p_token for update;
  else
    select * into v_r from public.requests where id = p_request_id for update;
  end if;
  if v_r.id is null then
    raise exception 'E_NOT_FOUND: request not found' using errcode = 'P0001';
  end if;
  -- By id: owner only. By token: possession of the private token is the
  -- credential (the original anonymous session may have been lost).
  if p_token is null and v_r.requester_id <> auth.uid() then
    raise exception 'E_FORBIDDEN: not your request' using errcode = 'P0001';
  end if;
  if v_r.status <> 'issued' then
    raise exception 'E_INVALID_STATUS: request is not issued' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.request_items ri
    join public.components c on c.id = ri.component_id
    where ri.request_id = v_r.id and c.returnable
      and coalesce(ri.issued_qty, 0) > 0 and ri.returned_qty is null
  ) then
    raise exception 'E_INVALID_STATUS: nothing to return on this request' using errcode = 'P0001';
  end if;
  if v_r.return_submitted_at is not null then
    raise exception 'E_ALREADY_SUBMITTED: return was already submitted' using errcode = 'P0001';
  end if;

  if p_photo_path is null
     or position((auth.uid()::text || '/') in p_photo_path) <> 1
     or char_length(p_photo_path) > 200
     or p_photo_path like '%..%' then
    raise exception 'E_INVALID_INPUT: a photo of the components is required' using errcode = 'P0001';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'E_INVALID_INPUT: note must be at most 300 characters' using errcode = 'P0001';
  end if;

  if p_receiver_staff_id is not null then
    select s.name, s.designation into v_name, v_designation
    from public.handover_staff s where s.id = p_receiver_staff_id and s.active;
    if v_name is null then
      raise exception 'E_INVALID_INPUT: choose a name from the list' using errcode = 'P0001';
    end if;
  else
    if char_length(v_in_name) not between 2 and 60
       or char_length(v_in_designation) not between 2 and 60 then
      raise exception 'E_INVALID_INPUT: receiver name and designation are required (2 to 60 characters)'
        using errcode = 'P0001';
    end if;
    v_name := v_in_name;
    v_designation := v_in_designation;
  end if;

  v_snapshot := case when v_designation is null then v_name else v_name || ' (' || v_designation || ')' end;

  update public.requests
    set return_submitted_at = v_now,
        return_receiver_staff_id = p_receiver_staff_id,
        return_receiver_name = v_name,
        return_receiver_designation = v_designation,
        return_photo_path = p_photo_path,
        return_note = v_note
    where id = v_r.id;

  insert into public.request_events (request_id, actor_id, from_status, to_status, note)
  values (v_r.id, auth.uid(), 'issued', 'issued', 'Return submitted: received by ' || v_snapshot);

  return jsonb_build_object('submitted_at', v_now, 'receiver', v_snapshot);
end;
$$;

-- p_photo_path precedes the defaulted args (Postgres requires defaults last);
-- the client always calls with named arguments.
create or replace function submit_return(
  p_request_id uuid,
  p_photo_path text,
  p_receiver_staff_id uuid default null,
  p_receiver_name text default null,
  p_receiver_designation text default null,
  p_note text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public._submit_return(p_request_id, null, p_photo_path,
    p_receiver_staff_id, p_receiver_name, p_receiver_designation, p_note);
$$;

create or replace function submit_return_by_token(
  p_token text,
  p_photo_path text,
  p_receiver_staff_id uuid default null,
  p_receiver_name text default null,
  p_receiver_designation text default null,
  p_note text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public._submit_return(null, p_token, p_photo_path,
    p_receiver_staff_id, p_receiver_name, p_receiver_designation, p_note);
$$;

-- ============================================================
-- reset_return_submission (staff): lets the student resubmit
-- ============================================================
create or replace function reset_return_submission(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.requests%rowtype;
begin
  if not public.is_staff() then
    raise exception 'E_FORBIDDEN: staff role required' using errcode = 'P0001';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'E_INVALID_INPUT: reason must be at least 3 characters' using errcode = 'P0001';
  end if;

  select * into v_r from public.requests where id = p_request_id for update;
  if v_r.id is null or v_r.return_submitted_at is null then
    raise exception 'E_NOT_FOUND: no return submission to reset' using errcode = 'P0001';
  end if;

  -- The cleanup queue already carries a bucket column, so the old photo is
  -- removed by the existing cleanup-screenshots function.
  if v_r.return_photo_path is not null then
    insert into public.storage_cleanup_queue (bucket, path, request_id, reason)
    values ('return-photos', v_r.return_photo_path, v_r.id, 'return_reset')
    on conflict (path) do nothing;
  end if;

  update public.requests
    set return_submitted_at = null,
        return_receiver_staff_id = null,
        return_receiver_name = null,
        return_receiver_designation = null,
        return_photo_path = null,
        return_note = null
    where id = v_r.id;

  insert into public.request_events (request_id, actor_id, from_status, to_status, note)
  values (v_r.id, auth.uid(), v_r.status, v_r.status, 'Return submission reset: ' || trim(p_reason));
end;
$$;

-- ============================================================
-- get_request_by_token: additive keys for the student return card
-- ============================================================
create or replace function get_request_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'status', r.status,
    'public_token', r.public_token,
    'code', r.request_code,
    'requester_name', r.requester_name,
    'expires_at', r.expires_at,
    'project_name', p.name,
    'reject_reason', r.reject_reason,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'name', c.name,
        'qty', ri.qty,
        'approved_qty', ri.approved_qty
      ))
      from public.request_items ri
      join public.components c on c.id = ri.component_id
      where ri.request_id = r.id
    ),
    'return_pending', (
      r.status = 'issued' and exists (
        select 1 from public.request_items ri
        join public.components c on c.id = ri.component_id
        where ri.request_id = r.id and c.returnable
          and coalesce(ri.issued_qty, 0) > 0 and ri.returned_qty is null
      )
    ),
    'return_submission', case
      when r.return_submitted_at is null then null
      else jsonb_build_object(
        'submitted_at', r.return_submitted_at,
        'receiver', case when r.return_receiver_designation is null then r.return_receiver_name
                         else r.return_receiver_name || ' (' || r.return_receiver_designation || ')' end,
        'photo_path', r.return_photo_path
      )
    end
  )
  into v_result
  from public.requests r
  left join public.projects p on p.id = r.project_id
  where r.public_token = p_token;

  if v_result is null then
    raise exception 'E_NOT_FOUND: request not found' using errcode = 'P0001';
  end if;

  return v_result;
end;
$$;

revoke all on function _submit_return(uuid, text, text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function list_handover_staff_public() from public, anon;
revoke all on function submit_return(uuid, text, uuid, text, text, text) from public, anon;
revoke all on function submit_return_by_token(text, text, uuid, text, text, text) from public, anon;
revoke all on function reset_return_submission(uuid, text) from public, anon;
revoke all on function get_request_by_token(text) from public, anon;
grant execute on function list_handover_staff_public() to authenticated;
grant execute on function submit_return(uuid, text, uuid, text, text, text) to authenticated;
grant execute on function submit_return_by_token(text, text, uuid, text, text, text) to authenticated;
grant execute on function reset_return_submission(uuid, text) to authenticated;
grant execute on function get_request_by_token(text) to authenticated;
