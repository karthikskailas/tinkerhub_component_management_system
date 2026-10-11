-- Screenshot auto-delete: once a request leaves the "needs review" state,
-- its verification screenshot is no longer needed. This queues the storage
-- path for deletion via a trigger (so no existing RPC needs to change) and
-- a separate edge function does the actual bucket delete + bookkeeping.
--
-- NOTE: numbered 0010, not 0009 as originally suggested — 0009 was already
-- taken by the projects RLS fix from Phase 2b. Do not renumber either file.

alter table requests add column if not exists screenshot_deleted_at timestamptz;

create table if not exists storage_cleanup_queue (
  id bigint generated always as identity primary key,
  bucket text not null default 'screenshots',
  path text not null unique,
  request_id uuid references requests (id) on delete set null,
  reason text,
  queued_at timestamptz not null default now(),
  done_at timestamptz
);

create index if not exists idx_storage_cleanup_queue_pending
  on storage_cleanup_queue (done_at)
  where done_at is null;

alter table storage_cleanup_queue enable row level security;

-- No policies: this table is only ever touched by the service-role client
-- (the cleanup edge function and the trigger below, which runs as the
-- function owner via security definer), so RLS blocks every other role by
-- default with nothing to opt in.
revoke all on storage_cleanup_queue from public, anon, authenticated;

create or replace function queue_screenshot_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.screenshot_path is not null and new.screenshot_deleted_at is null then
    insert into public.storage_cleanup_queue (path, request_id, reason)
    values (new.screenshot_path, new.id, 'status:' || new.status::text)
    on conflict (path) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_requests_queue_screenshot_cleanup on requests;
create trigger trg_requests_queue_screenshot_cleanup
  after update of status on requests
  for each row
  when (
    new.status in ('approved', 'rejected', 'cancelled', 'expired')
    and old.status is distinct from new.status
  )
  execute function queue_screenshot_cleanup();
