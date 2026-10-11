-- Staff-facing RPCs: approve_request, reject_request, admin_cancel_request,
-- issue_request, verify_return.

-- ============================================================
-- approve_request (admin only)
-- ============================================================
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

-- ============================================================
-- reject_request (admin only)
-- ============================================================
create or replace function reject_request(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  if not public.is_admin() then
    raise exception 'E_FORBIDDEN: admin role required' using errcode = 'P0001';
  end if;

  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'E_INVALID_INPUT: reason must be at least 3 characters' using errcode = 'P0001';
  end if;

  update public.requests
    set status = 'rejected',
        reject_reason = p_reason,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_request_id and status = 'pending';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'E_INVALID_STATUS: request is not pending' using errcode = 'P0001';
  end if;

  insert into public.request_events (request_id, actor_id, from_status, to_status, note)
  values (p_request_id, auth.uid(), 'pending', 'rejected', p_reason);
end;
$$;

revoke all on function reject_request(uuid, text) from public, anon;
grant execute on function reject_request(uuid, text) to authenticated;

-- ============================================================
-- admin_cancel_request (admin only)
-- ============================================================
create or replace function admin_cancel_request(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.request_status;
begin
  if not public.is_admin() then
    raise exception 'E_FORBIDDEN: admin role required' using errcode = 'P0001';
  end if;

  select status into v_status from public.requests where id = p_request_id for update;
  if v_status is null then
    raise exception 'E_NOT_FOUND: request not found' using errcode = 'P0001';
  end if;
  if v_status not in ('pending', 'approved') then
    raise exception 'E_INVALID_STATUS: request cannot be cancelled' using errcode = 'P0001';
  end if;

  if v_status = 'approved' then
    perform 1
    from public.components c
    where c.id in (select ri.component_id from public.request_items ri where ri.request_id = p_request_id)
    order by c.id
    for update;

    update public.components c
      set reserved = reserved - ri.approved_qty
      from public.request_items ri
      where ri.request_id = p_request_id
        and ri.component_id = c.id
        and ri.approved_qty > 0;
  end if;

  update public.requests
    set status = 'cancelled', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;

  insert into public.request_events (request_id, actor_id, from_status, to_status, note)
  values (p_request_id, auth.uid(), v_status, 'cancelled', p_reason);
end;
$$;

revoke all on function admin_cancel_request(uuid, text) from public, anon;
grant execute on function admin_cancel_request(uuid, text) to authenticated;

-- ============================================================
-- issue_request (inventory_manager or admin)
-- ============================================================
create or replace function issue_request(p_request_id uuid, p_items jsonb default null)
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
    set status = 'issued', issued_at = now(), issued_by = auth.uid()
    where id = p_request_id;

  insert into public.request_events (request_id, actor_id, from_status, to_status, note)
  values (p_request_id, auth.uid(), 'approved', 'issued', 'issued');

  if not v_has_returnable then
    update public.requests
      set status = 'returned', returned_at = now()
      where id = p_request_id;

    insert into public.request_events (request_id, actor_id, from_status, to_status, note)
    values (p_request_id, auth.uid(), 'issued', 'returned', 'no returnable items, auto-completed');
  end if;
end;
$$;

revoke all on function issue_request(uuid, jsonb) from public, anon;
grant execute on function issue_request(uuid, jsonb) to authenticated;

-- ============================================================
-- verify_return (inventory_manager or admin)
-- ============================================================
create or replace function verify_return(p_request_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.request_status;
  v_item jsonb;
  v_component_id uuid;
  v_returned_qty int;
  v_condition public.item_condition;
  v_note text;
  v_issued_qty int;
  v_already_returned int;
  v_all_resolved boolean;
  v_old_count int;
  v_new_count int;
begin
  if not public.is_staff() then
    raise exception 'E_FORBIDDEN: staff role required' using errcode = 'P0001';
  end if;

  select status into v_status from public.requests where id = p_request_id for update;
  if v_status is null then
    raise exception 'E_NOT_FOUND: request not found' using errcode = 'P0001';
  end if;
  if v_status <> 'issued' then
    raise exception 'E_INVALID_STATUS: request is not issued' using errcode = 'P0001';
  end if;

  perform 1
  from public.components c
  where c.id in (select (elem->>'component_id')::uuid from jsonb_array_elements(p_items) elem)
  order by c.id
  for update;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_component_id := (v_item->>'component_id')::uuid;
    v_returned_qty := (v_item->>'returned_qty')::int;
    v_condition := (v_item->>'condition')::public.item_condition;
    v_note := v_item->>'note';

    select ri.issued_qty, ri.returned_qty into v_issued_qty, v_already_returned
    from public.request_items ri
    join public.components c on c.id = ri.component_id
    where ri.request_id = p_request_id and ri.component_id = v_component_id and c.returnable;

    if v_issued_qty is null then
      -- not a returnable line on this request; skip silently
      continue;
    end if;

    if v_already_returned is not null then
      -- already finalized in an earlier call: idempotent, do not double-apply
      continue;
    end if;

    if v_returned_qty is null or v_returned_qty < 0 or v_returned_qty > v_issued_qty then
      raise exception 'E_INVALID_ITEMS: returned_qty must be between 0 and issued_qty' using errcode = 'P0001';
    end if;
    if v_condition is null then
      raise exception 'E_INVALID_ITEMS: condition is required' using errcode = 'P0001';
    end if;

    update public.request_items
      set returned_qty = v_returned_qty, condition = v_condition, note = v_note
      where request_id = p_request_id and component_id = v_component_id;

    if v_condition = 'ok' and v_returned_qty > 0 then
      select count into v_old_count from public.components where id = v_component_id;
      v_new_count := v_old_count + v_returned_qty;

      update public.components set count = v_new_count where id = v_component_id;

      insert into public.inventory_adjustments
        (component_id, old_count, new_count, reason, source, actor_id)
      values
        (v_component_id, v_old_count, v_new_count, 'return: ' || v_condition, 'verify_return', auth.uid());
    else
      insert into public.inventory_adjustments
        (component_id, old_count, new_count, reason, source, actor_id)
      select v_component_id, c.count, c.count, 'return: ' || v_condition, 'verify_return', auth.uid()
      from public.components c where c.id = v_component_id;
    end if;
  end loop;

  select not exists (
    select 1
    from public.request_items ri
    join public.components c on c.id = ri.component_id
    where ri.request_id = p_request_id and c.returnable and ri.issued_qty > 0 and ri.returned_qty is null
  ) into v_all_resolved;

  if v_all_resolved then
    update public.requests
      set status = 'returned', returned_at = now()
      where id = p_request_id;

    insert into public.request_events (request_id, actor_id, from_status, to_status, note)
    values (p_request_id, auth.uid(), 'issued', 'returned', 'all returnable items verified');
  end if;
end;
$$;

revoke all on function verify_return(uuid, jsonb) from public, anon;
grant execute on function verify_return(uuid, jsonb) to authenticated;
