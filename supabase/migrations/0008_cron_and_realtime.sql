-- Scheduled expiry of stale approvals + realtime publication for requests.

create extension if not exists pg_cron;

-- Internal only: no grants are issued, so authenticated/anon can never call this
-- directly. It is invoked solely by the pg_cron job below.
create or replace function expire_stale_approvals()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request record;
begin
  for v_request in
    select id from public.requests
    where status = 'approved' and expires_at < now()
    order by id
    for update
  loop
    perform 1
    from public.components c
    where c.id in (
      select ri.component_id from public.request_items ri where ri.request_id = v_request.id
    )
    order by c.id
    for update;

    update public.components c
      set reserved = reserved - ri.approved_qty
      from public.request_items ri
      where ri.request_id = v_request.id
        and ri.component_id = c.id
        and ri.approved_qty > 0;

    update public.requests
      set status = 'expired'
      where id = v_request.id;

    insert into public.request_events (request_id, actor_id, from_status, to_status, note)
    values (v_request.id, null, 'approved', 'expired', 'approval expired, stock released');
  end loop;
end;
$$;

revoke all on function expire_stale_approvals() from public, anon, authenticated;

select cron.schedule(
  'expire-stale-approvals',
  '0 * * * *',
  $$select expire_stale_approvals()$$
);

-- Realtime: requests and request_items get live updates. RLS still applies to
-- realtime changefeeds, so a client only receives rows it could SELECT (its
-- own requests); staff receive all rows. replica identity stays DEFAULT since
-- we only need the primary key to identify changed rows for UPDATE/DELETE —
-- FULL would be needed only if clients needed old column values on UPDATE,
-- which the frontend does not use.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests'
  ) then
    alter publication supabase_realtime add table requests;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'request_items'
  ) then
    alter publication supabase_realtime add table request_items;
  end if;
end $$;
