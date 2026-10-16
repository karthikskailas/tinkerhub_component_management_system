-- approve_request now returns expires_at and public_token in its own JSON, so the admin
-- UI no longer needs a second round trip right after approving. Same signature and
-- behaviour; only two extra keys in the result.

create or replace function approve_request(p_request_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.request_status;
  v_item jsonb;
  v_component_id uuid;
  v_approved_qty int;
  v_requested_qty int;
  v_count int;
  v_reserved int;
  v_name text;
  v_any_positive boolean := false;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'E_FORBIDDEN: admin role required' using errcode = 'P0001';
  end if;

  select status into v_status from public.requests where id = p_request_id for update;
  if v_status is null then
    raise exception 'E_NOT_FOUND: request not found' using errcode = 'P0001';
  end if;
  if v_status <> 'pending' then
    raise exception 'E_INVALID_STATUS: request is not pending' using errcode = 'P0001';
  end if;

  -- Lock involved component rows in a stable order to avoid deadlocks with
  -- concurrent approvals touching overlapping components.
  perform 1
  from public.components c
  where c.id in (
    select (elem->>'component_id')::uuid from jsonb_array_elements(p_items) elem
  )
  order by c.id
  for update;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_component_id := (v_item->>'component_id')::uuid;
    v_approved_qty := (v_item->>'approved_qty')::int;

    select qty into v_requested_qty
    from public.request_items
    where request_id = p_request_id and component_id = v_component_id;

    if v_requested_qty is null then
      raise exception 'E_INVALID_ITEMS: component not part of this request' using errcode = 'P0001';
    end if;

    if v_approved_qty is null or v_approved_qty < 0 then
      raise exception 'E_INVALID_ITEMS: approved_qty must be >= 0' using errcode = 'P0001';
    end if;

    if v_approved_qty > v_requested_qty then
      raise exception 'E_INVALID_ITEMS: approved_qty cannot exceed requested qty' using errcode = 'P0001';
    end if;

    if v_approved_qty > 0 then
      v_any_positive := true;

      select count, reserved, name into v_count, v_reserved, v_name
      from public.components where id = v_component_id;

      if (v_count - v_reserved) < v_approved_qty then
        raise exception 'E_STOCK: % only % available', v_name, (v_count - v_reserved) using errcode = 'P0001';
      end if;

      update public.components
        set reserved = reserved + v_approved_qty
        where id = v_component_id;
    end if;

    update public.request_items
      set approved_qty = v_approved_qty
      where request_id = p_request_id and component_id = v_component_id;
  end loop;

  if not v_any_positive then
    raise exception 'E_INVALID_ITEMS: at least one line must be approved' using errcode = 'P0001';
  end if;

  update public.requests
    set status = 'approved',
        approved_at = now(),
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        expires_at = now() + interval '7 days'
    where id = p_request_id;

  insert into public.request_events (request_id, actor_id, from_status, to_status, note)
  values (p_request_id, auth.uid(), 'pending', 'approved', 'approved');

  select jsonb_build_object(
    'request_id', r.id,
    'short_code', upper(left(r.id::text, 8)),
    'requester_name', r.requester_name,
    'phone', r.phone,
    'project_name', p.name,
    'expires_at', r.expires_at,
    'public_token', r.public_token,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'name', c.name,
        'location', c.location,
        'approved_qty', ri.approved_qty
      ))
      from public.request_items ri
      join public.components c on c.id = ri.component_id
      where ri.request_id = r.id and ri.approved_qty > 0
    )
  )
  into v_result
  from public.requests r
  left join public.projects p on p.id = r.project_id
  where r.id = p_request_id;

  return v_result;
end;
$$;

revoke all on function approve_request(uuid, jsonb) from public, anon;
grant execute on function approve_request(uuid, jsonb) to authenticated;
