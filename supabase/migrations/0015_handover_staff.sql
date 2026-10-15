-- On-site handover staff: people who may confirm a physical handover without
-- a system login. Managed by admin / inventory_manager through RPCs only.

create table if not exists handover_staff (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  designation text check (designation is null or char_length(designation) between 2 and 60),
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_handover_staff_name_unique
  on handover_staff (lower(trim(name)));

alter table handover_staff enable row level security;

drop policy if exists handover_staff_select_managers on handover_staff;
create policy handover_staff_select_managers on handover_staff
  for select to authenticated
  using (public.is_staff());

revoke all on handover_staff from public, anon, authenticated;
grant select on handover_staff to authenticated;

-- Shared sliding-window limiter (same table/semantics find_projects uses inline).
create or replace function check_rate_limit(p_action text, p_max int, p_minutes int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  select rl.window_start, rl.count into v_window_start, v_count
  from public.rate_limits rl
  where rl.uid = auth.uid() and rl.action = p_action
  for update;

  if v_window_start is null or v_window_start < now() - make_interval(mins => p_minutes) then
    insert into public.rate_limits (uid, action, window_start, count)
    values (auth.uid(), p_action, now(), 1)
    on conflict (uid, action) do update set window_start = now(), count = 1;
  else
    if v_count >= p_max then
      raise exception 'E_RATE_LIMIT: too many requests, try again later' using errcode = 'P0001';
    end if;
    update public.rate_limits set count = count + 1
    where uid = auth.uid() and action = p_action;
  end if;
end;
$$;

revoke all on function check_rate_limit(text, int, int) from public, anon, authenticated;

create or replace function add_handover_staff(p_name text, p_designation text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_designation text := nullif(trim(coalesce(p_designation, '')), '');
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'E_FORBIDDEN: staff role required' using errcode = 'P0001';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60
     or (v_designation is not null and (char_length(v_designation) < 2 or char_length(v_designation) > 60)) then
    raise exception 'E_INVALID_INPUT: name and designation must be 2 to 60 characters' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.handover_staff where lower(trim(name)) = lower(v_name)) then
    raise exception 'E_DUPLICATE: that name is already on the list' using errcode = 'P0001';
  end if;

  insert into public.handover_staff (name, designation)
  values (v_name, v_designation)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function set_handover_staff_active(p_id uuid, p_active boolean)
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
  if p_id is null or p_active is null then
    raise exception 'E_INVALID_INPUT: id and active are required' using errcode = 'P0001';
  end if;
  update public.handover_staff set active = p_active where id = p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'E_NOT_FOUND: staff entry not found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function add_handover_staff(text, text) from public, anon;
revoke all on function set_handover_staff_active(uuid, boolean) from public, anon;
grant execute on function add_handover_staff(text, text) to authenticated;
grant execute on function set_handover_staff_active(uuid, boolean) to authenticated;
