-- Phase 4.4: delete a component. Only allowed when nothing references it:
-- no request has ever included it and no units are reserved. Anything with
-- request history must be kept (set its count to 0 instead), so past
-- requests, returns and reports never lose their component.

create table if not exists component_deletions (
  id bigint generated always as identity primary key,
  component_id uuid not null,
  name text not null,
  location text,
  count int,
  actor_id uuid,
  reason text,
  created_at timestamptz not null default now()
);

alter table component_deletions enable row level security;
drop policy if exists component_deletions_select_staff on component_deletions;
create policy component_deletions_select_staff on component_deletions
  for select to authenticated using (is_staff());
grant select on component_deletions to authenticated;

create or replace function delete_component(p_component_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.components%rowtype;
begin
  if public.staff_role() is null or public.staff_role()::text not in ('admin', 'inventory_manager') then
    raise exception 'E_FORBIDDEN: admin or inventory manager role required' using errcode = 'P0001';
  end if;

  select * into v_c from public.components where id = p_component_id for update;
  if not found then
    raise exception 'E_NOT_FOUND: component not found' using errcode = 'P0001';
  end if;

  if v_c.reserved > 0 or exists (
    select 1 from public.request_items where component_id = p_component_id
  ) then
    raise exception 'E_IN_USE: this component appears in requests, so it can''t be deleted. Set its count to 0 instead.'
      using errcode = 'P0001';
  end if;

  insert into public.component_deletions (component_id, name, location, count, actor_id, reason)
  values (v_c.id, v_c.name, v_c.location, v_c.count, auth.uid(), nullif(trim(p_reason), ''));

  delete from public.inventory_adjustments where component_id = p_component_id;
  delete from public.components where id = p_component_id;  -- component_edits cascades
end;
$$;

revoke all on function delete_component(uuid, text) from public, anon;
grant execute on function delete_component(uuid, text) to authenticated;
