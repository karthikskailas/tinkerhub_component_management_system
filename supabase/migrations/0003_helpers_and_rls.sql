-- Helper functions and row-level security policies

create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s where s.user_id = auth.uid() and s.active
  );
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid() and s.active and s.role = 'admin'
  );
$$;

create or replace function staff_role()
returns staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select s.role from public.staff s where s.user_id = auth.uid() and s.active;
$$;

revoke all on function is_staff() from public, anon;
revoke all on function is_admin() from public, anon;
revoke all on function staff_role() from public, anon;
grant execute on function is_staff() to authenticated;
grant execute on function is_admin() to authenticated;
grant execute on function staff_role() to authenticated;

-- Lock down default privileges: no table is readable by anon/public by default.
revoke all on all tables in schema public from public;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from public;
revoke all on all sequences in schema public from anon;

alter table staff enable row level security;
alter table components enable row level security;
alter table projects enable row level security;
alter table requests enable row level security;
alter table request_items enable row level security;
alter table request_events enable row level security;
alter table inventory_adjustments enable row level security;

-- staff: self or admin can read; all writes go through the create-staff edge function
-- (service role bypasses RLS, so no insert/update/delete policies are defined here).
drop policy if exists staff_select_self_or_admin on staff;
create policy staff_select_self_or_admin on staff
  for select to authenticated
  using (user_id = auth.uid() or is_admin());

-- components: staff-only direct SELECT; all writes happen via security-definer RPCs.
drop policy if exists components_select_staff on components;
create policy components_select_staff on components
  for select to authenticated
  using (is_staff());

-- component_catalog: client-facing view, deliberately bypasses RLS on components.
-- Exposes only id/name/description/returnable/available (count - reserved), never
-- location or raw count, so clients can build the request picker without seeing
-- warehouse layout or exact stock depth.
create or replace view component_catalog
with (security_invoker = false)
as
select
  id,
  name,
  description,
  returnable,
  (count - reserved) as available
from components;

grant select on component_catalog to authenticated;

-- projects: owner can see their own rows, staff see all; inserts only via RPC.
drop policy if exists projects_select_owner_or_staff on projects;
create policy projects_select_owner_or_staff on projects
  for select to authenticated
  using (created_by = auth.uid() or is_staff());

-- requests: client sees own rows, staff see all; no direct writes (RPC-only).
drop policy if exists requests_select_owner_or_staff on requests;
create policy requests_select_owner_or_staff on requests
  for select to authenticated
  using (requester_id = auth.uid() or is_staff());

-- request_items: follows the parent request's visibility.
drop policy if exists request_items_select_owner_or_staff on request_items;
create policy request_items_select_owner_or_staff on request_items
  for select to authenticated
  using (
    is_staff()
    or exists (
      select 1 from requests r
      where r.id = request_items.request_id and r.requester_id = auth.uid()
    )
  );

-- request_events: client reads events for own requests; staff read all.
drop policy if exists request_events_select_owner_or_staff on request_events;
create policy request_events_select_owner_or_staff on request_events
  for select to authenticated
  using (
    is_staff()
    or exists (
      select 1 from requests r
      where r.id = request_events.request_id and r.requester_id = auth.uid()
    )
  );

-- inventory_adjustments: staff read-only.
drop policy if exists inventory_adjustments_select_staff on inventory_adjustments;
create policy inventory_adjustments_select_staff on inventory_adjustments
  for select to authenticated
  using (is_staff());

-- Grants: authenticated gets only SELECT on base tables (writes are via
-- security-definer RPCs, which run as the function owner regardless of grants).
grant select on staff, components, projects, requests, request_items, request_events, inventory_adjustments
  to authenticated;
