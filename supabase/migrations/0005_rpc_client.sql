-- Client-facing RPCs: find_projects, submit_request, cancel_request,
-- get_request_by_token, resubmit_request.

-- Small per-uid sliding-window counter backing find_projects' rate limit.
create table if not exists rate_limits (
  uid uuid not null,
  action text not null,
  window_start timestamptz not null default now(),
  count int not null default 0,
  primary key (uid, action)
);

alter table rate_limits enable row level security;
revoke all on rate_limits from public, anon, authenticated;

-- ============================================================
-- find_projects
-- ============================================================
create or replace function find_projects(p_phone text)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_window_start timestamptz;
  v_count int;
begin
  v_phone := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  if length(v_phone) <> 10 then
    raise exception 'E_INVALID_PHONE: phone number must have 10 digits' using errcode = 'P0001';
  end if;

  select rl.window_start, rl.count into v_window_start, v_count
  from public.rate_limits rl
  where rl.uid = auth.uid() and rl.action = 'find_projects'
  for update;

  if v_window_start is null or v_window_start < now() - interval '10 minutes' then
    insert into public.rate_limits (uid, action, window_start, count)
    values (auth.uid(), 'find_projects', now(), 1)
    on conflict (uid, action) do update
      set window_start = now(), count = 1;
  else
    if v_count >= 20 then
      raise exception 'E_RATE_LIMIT: too many lookups, try again later' using errcode = 'P0001';
    end if;
    update public.rate_limits
      set count = count + 1
      where uid = auth.uid() and action = 'find_projects';
  end if;

  return query
    select p.id, p.name
    from public.projects p
    where p.phone = v_phone
    order by p.created_at desc
    limit 20;
end;
$$;

revoke all on function find_projects(text) from public, anon;
grant execute on function find_projects(text) to authenticated;

-- ============================================================
-- submit_request
-- ============================================================
create or replace function submit_request(
  p_project_id uuid,
  p_new_project jsonb,
  p_requester_name text,
  p_phone text,
  p_screenshot_path text,
  p_items jsonb
)
returns table (id uuid, public_token text, status request_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_project_id uuid;
  v_request_id uuid;
  v_public_token text;
  v_open_count int;
  v_item jsonb;
  v_item_count int;
  v_dup_count int;
begin
  v_phone := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  if length(v_phone) <> 10 then
    raise exception 'E_INVALID_PHONE: phone number must have 10 digits' using errcode = 'P0001';
  end if;

  if p_requester_name is null or length(trim(p_requester_name)) = 0 then
    raise exception 'E_INVALID_INPUT: requester name is required' using errcode = 'P0001';
  end if;

  if p_screenshot_path is null
     or p_screenshot_path not like (auth.uid()::text || '/%') then
    raise exception 'E_INVALID_SCREENSHOT: screenshot path is missing or not owned by caller' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'E_INVALID_ITEMS: at least one item is required' using errcode = 'P0001';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count > 50 then
    raise exception 'E_TOO_MANY_ITEMS: at most 50 item lines are allowed' using errcode = 'P0001';
  end if;

  select count(*) into v_dup_count
  from (
    select (elem->>'component_id')::uuid as component_id
    from jsonb_array_elements(p_items) elem
  ) x
  group by component_id
  having count(*) > 1
  limit 1;

  if v_dup_count is not null then
    raise exception 'E_DUPLICATE_ITEM: duplicate component in request' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'qty') is null or (v_item->>'qty')::int <= 0 then
      raise exception 'E_INVALID_ITEMS: qty must be greater than 0' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.components c where c.id = (v_item->>'component_id')::uuid) then
      raise exception 'E_INVALID_ITEMS: unknown component' using errcode = 'P0001';
    end if;
  end loop;

  select count(*) into v_open_count
  from public.requests r
  where r.requester_id = auth.uid() and r.status in ('pending', 'approved');

  if v_open_count >= 3 then
    raise exception 'E_TOO_MANY_OPEN_REQUESTS: you already have 3 open requests' using errcode = 'P0001';
  end if;

  if p_project_id is not null then
    select p.id into v_project_id
    from public.projects p
    where p.id = p_project_id and p.phone = v_phone;

    if v_project_id is null then
      raise exception 'E_PROJECT_NOT_FOUND: project does not match phone number' using errcode = 'P0001';
    end if;
  elsif p_new_project is not null then
    if coalesce(trim(p_new_project->>'name'), '') = '' then
      raise exception 'E_INVALID_INPUT: project name is required' using errcode = 'P0001';
    end if;

    insert into public.projects (name, description, owner_name, phone, created_by)
    values (
      p_new_project->>'name',
      p_new_project->>'description',
      p_new_project->>'owner_name',
      v_phone,
      auth.uid()
    )
    returning projects.id into v_project_id;
  else
    raise exception 'E_INVALID_INPUT: either p_project_id or p_new_project is required' using errcode = 'P0001';
  end if;

  insert into public.requests (project_id, requester_id, requester_name, phone, screenshot_path, status)
  values (v_project_id, auth.uid(), trim(p_requester_name), v_phone, p_screenshot_path, 'pending')
  returning requests.id, requests.public_token into v_request_id, v_public_token;

  insert into public.request_items (request_id, component_id, qty)
  select v_request_id, (elem->>'component_id')::uuid, (elem->>'qty')::int
  from jsonb_array_elements(p_items) elem;

  insert into public.request_events (request_id, actor_id, from_status, to_status, note)
  values (v_request_id, auth.uid(), null, 'pending', 'submitted');

  return query select v_request_id, v_public_token, 'pending'::public.request_status;
end;
$$;

revoke all on function submit_request(uuid, jsonb, text, text, text, jsonb) from public, anon;
grant execute on function submit_request(uuid, jsonb, text, text, text, jsonb) to authenticated;

-- ============================================================
-- cancel_request
-- ============================================================
create or replace function cancel_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  update public.requests
    set status = 'cancelled'
    where id = p_request_id
      and requester_id = auth.uid()
      and status = 'pending';

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    raise exception 'E_NOT_CANCELLABLE: request cannot be cancelled' using errcode = 'P0001';
  end if;

  insert into public.request_events (request_id, actor_id, from_status, to_status, note)
  values (p_request_id, auth.uid(), 'pending', 'cancelled', 'cancelled by requester');
end;
$$;

revoke all on function cancel_request(uuid) from public, anon;
grant execute on function cancel_request(uuid) to authenticated;

-- ============================================================
-- get_request_by_token
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
-- resubmit_request
-- ============================================================
create or replace function resubmit_request(p_old_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'project_id', r.project_id,
    'project_name', p.name,
    'requester_name', r.requester_name,
    'phone', r.phone,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'component_id', ri.component_id,
        'qty', ri.qty
      ))
      from public.request_items ri
      where ri.request_id = r.id
    )
  )
  into v_result
  from public.requests r
  left join public.projects p on p.id = r.project_id
  where r.id = p_old_request_id
    and r.requester_id = auth.uid()
    and r.status = 'rejected';

  if v_result is null then
    raise exception 'E_NOT_FOUND: rejected request not found' using errcode = 'P0001';
  end if;

  return v_result;
end;
$$;

revoke all on function resubmit_request(uuid) from public, anon;
grant execute on function resubmit_request(uuid) to authenticated;
