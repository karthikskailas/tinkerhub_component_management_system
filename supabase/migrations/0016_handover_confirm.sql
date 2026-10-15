-- On-site handover confirmation. Records WHO handed over and WHEN; never
-- touches stock or request status (issue_request still does that).

alter table requests
  add column if not exists handover_confirmed_at timestamptz,
  add column if not exists handover_confirmed_by text,
  add column if not exists handed_over_by text;

-- get_request_by_token: same signature, extra fields the client QR card needs.
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
    )
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

revoke all on function get_request_by_token(text) from public, anon;
grant execute on function get_request_by_token(text) to authenticated;

-- ============================================================
-- get_handover_page
-- ============================================================
create or replace function get_handover_page(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.requests%rowtype;
  v_project text;
begin
  perform public.check_rate_limit('handover_page', 30, 10);

  select * into v_r from public.requests where public_token = p_token;
  if v_r.id is null then
    raise exception 'E_NOT_FOUND: request not found' using errcode = 'P0001';
  end if;
  if v_r.status <> 'approved' or (v_r.expires_at is not null and v_r.expires_at < now()) then
    raise exception 'E_INVALID_STATUS: %',
      case when v_r.status = 'approved' then 'expired' else v_r.status::text end
      using errcode = 'P0001';
  end if;

  select name into v_project from public.projects where id = v_r.project_id;

  return jsonb_build_object(
    'code', v_r.request_code,
    'requester_name', v_r.requester_name,
    'phone_last4', right(v_r.phone, 4),
    'project_name', v_project,
    'expires_at', v_r.expires_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.name, 'location', c.location, 'qty', ri.approved_qty)
                       order by c.name)
      from public.request_items ri
      join public.components c on c.id = ri.component_id
      where ri.request_id = v_r.id and ri.approved_qty > 0
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'designation', s.designation)
                       order by s.name)
      from public.handover_staff s where s.active
    ), '[]'::jsonb),
    'already_confirmed', case
      when v_r.handover_confirmed_at is null then null
      else jsonb_build_object('by', v_r.handover_confirmed_by, 'at', v_r.handover_confirmed_at)
    end
  );
end;
$$;

-- ============================================================
-- confirm_handover
-- ============================================================
create or replace function confirm_handover(
  p_token text,
  p_staff_id uuid default null,
  p_other_name text default null,
  p_other_designation text default null
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
  v_other_name text := trim(coalesce(p_other_name, ''));
  v_other_designation text := trim(coalesce(p_other_designation, ''));
  v_now timestamptz := now();
begin
  perform public.check_rate_limit('handover_confirm', 30, 10);

  if p_staff_id is not null then
    select s.name, s.designation into v_name, v_designation
    from public.handover_staff s where s.id = p_staff_id and s.active;
    if v_name is null then
      raise exception 'E_INVALID_INPUT: choose a name from the list' using errcode = 'P0001';
    end if;
  else
    if char_length(v_other_name) not between 2 and 60
       or char_length(v_other_designation) not between 2 and 60 then
      raise exception 'E_INVALID_INPUT: name and designation are required (2 to 60 characters)' using errcode = 'P0001';
    end if;
    v_name := v_other_name;
    v_designation := v_other_designation;
  end if;

  v_snapshot := case when v_designation is null then v_name else v_name || ' (' || v_designation || ')' end;

  select * into v_r from public.requests where public_token = p_token for update;
  if v_r.id is null then
    raise exception 'E_NOT_FOUND: request not found' using errcode = 'P0001';
  end if;
  if v_r.status <> 'approved' or (v_r.expires_at is not null and v_r.expires_at < now()) then
    raise exception 'E_INVALID_STATUS: %',
      case when v_r.status = 'approved' then 'expired' else v_r.status::text end
      using errcode = 'P0001';
  end if;
  if v_r.handover_confirmed_at is not null then
    raise exception 'E_ALREADY_CONFIRMED: already confirmed by % at %',
      v_r.handover_confirmed_by, v_r.handover_confirmed_at using errcode = 'P0001';
  end if;

  update public.requests
    set handover_confirmed_at = v_now, handover_confirmed_by = v_snapshot
    where id = v_r.id;

  insert into public.request_events (request_id, actor_id, from_status, to_status, note)
  values (v_r.id, null, 'approved', 'approved', 'Handover confirmed by ' || v_snapshot);

  return jsonb_build_object('confirmed_by', v_snapshot, 'confirmed_at', v_now);
end;
$$;

-- ============================================================
-- reset_handover_confirmation
-- ============================================================
create or replace function reset_handover_confirmation(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  if not public.is_staff() then
    raise exception 'E_FORBIDDEN: staff role required' using errcode = 'P0001';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'E_INVALID_INPUT: reason must be at least 3 characters' using errcode = 'P0001';
  end if;

  update public.requests
    set handover_confirmed_at = null, handover_confirmed_by = null
    where id = p_request_id and handover_confirmed_at is not null;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'E_NOT_FOUND: no confirmation to reset' using errcode = 'P0001';
  end if;

  insert into public.request_events (request_id, actor_id, from_status, to_status, note)
  select r.id, auth.uid(), r.status, r.status, 'Handover confirmation reset: ' || trim(p_reason)
  from public.requests r where r.id = p_request_id;
end;
$$;

revoke all on function get_handover_page(text) from public, anon;
revoke all on function confirm_handover(text, uuid, text, text) from public, anon;
revoke all on function reset_handover_confirmation(uuid, text) from public, anon;
grant execute on function get_handover_page(text) to authenticated;
grant execute on function confirm_handover(text, uuid, text, text) to authenticated;
grant execute on function reset_handover_confirmation(uuid, text) to authenticated;

-- ============================================================
-- issue_request: add p_handed_over_by. Drop the old signature so PostgREST
-- sees no overload. Behaviour is otherwise unchanged from 0006.
-- ============================================================
drop function if exists issue_request(uuid, jsonb);

create or replace function issue_request(
  p_request_id uuid,
  p_items jsonb default null,
  p_handed_over_by text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.request_status;
  v_expires_at timestamptz;
  v_component_id uuid;
  v_approved_qty int;
  v_issued_qty int;
  v_has_returnable boolean;
  v_by text := nullif(left(trim(coalesce(p_handed_over_by, '')), 80), '');
begin
  if not public.is_staff() then
    raise exception 'E_FORBIDDEN: staff role required' using errcode = 'P0001';
  end if;

  select status, expires_at into v_status, v_expires_at
  from public.requests where id = p_request_id for update;

  if v_status is null then
    raise exception 'E_NOT_FOUND: request not found' using errcode = 'P0001';
  end if;
  if v_status <> 'approved' then
    raise exception 'E_INVALID_STATUS: request is not approved' using errcode = 'P0001';
  end if;
  if v_expires_at is not null and v_expires_at < now() then
    raise exception 'E_EXPIRED: approval has expired' using errcode = 'P0001';
  end if;

  perform 1
  from public.components c
  where c.id in (select ri.component_id from public.request_items ri where ri.request_id = p_request_id and ri.approved_qty > 0)
  order by c.id
  for update;

  for v_component_id, v_approved_qty in
    select ri.component_id, ri.approved_qty
    from public.request_items ri
    where ri.request_id = p_request_id and ri.approved_qty > 0
  loop
    select (elem->>'issued_qty')::int into v_issued_qty
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) elem
    where (elem->>'component_id')::uuid = v_component_id;

    v_issued_qty := coalesce(v_issued_qty, v_approved_qty);

    if v_issued_qty < 0 or v_issued_qty > v_approved_qty then
      raise exception 'E_INVALID_ITEMS: issued_qty must be between 0 and approved_qty' using errcode = 'P0001';
    end if;

    update public.components
      set count = count - v_issued_qty,
          reserved = reserved - v_approved_qty
      where id = v_component_id;

    update public.request_items
      set issued_qty = v_issued_qty
      where request_id = p_request_id and component_id = v_component_id;
  end loop;

  select exists (
    select 1
    from public.request_items ri
    join public.components c on c.id = ri.component_id
    where ri.request_id = p_request_id and ri.approved_qty > 0 and c.returnable
  ) into v_has_returnable;

  update public.requests
    set status = 'issued', issued_at = now(), issued_by = auth.uid(), handed_over_by = v_by
    where id = p_request_id;

  insert into public.request_events (request_id, actor_id, from_status, to_status, note)
  values (p_request_id, auth.uid(), 'approved', 'issued',
          case when v_by is null then 'issued' else 'issued. Handed over by ' || v_by end);

  if not v_has_returnable then
    update public.requests
      set status = 'returned', returned_at = now()
      where id = p_request_id;

    insert into public.request_events (request_id, actor_id, from_status, to_status, note)
    values (p_request_id, auth.uid(), 'issued', 'returned', 'no returnable items, auto-completed');
  end if;
end;
$$;

revoke all on function issue_request(uuid, jsonb, text) from public, anon;
grant execute on function issue_request(uuid, jsonb, text) to authenticated;
