-- storage_cleanup_queue trigger: approve/reject/cancel each enqueue exactly
-- one row, a repeated status transition doesn't duplicate it, and clients
-- have no access to the queue table at all.
begin;
create extension if not exists pgtap;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email) values
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-sq@test.local'),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-sq-a@test.local'),
  ('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-sq-b@test.local'),
  ('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-sq-c@test.local');

insert into staff (user_id, role) values ('b0000000-0000-0000-0000-000000000001', 'admin');

insert into components (id, name, location, count, reserved) values
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'Jumper Wires', 'Bin G1', 50, 0);

-- Three pending requests, one per path (approve / reject / cancel).
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Proj SQ-A"}'::jsonb, 'A', '9876500010',
  'b0000000-0000-0000-0000-000000000002/approve-path.webp',
  '[{"component_id":"bbbbbbbb-0000-0000-0000-00000000000a","qty":1}]'::jsonb);

set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Proj SQ-B"}'::jsonb, 'B', '9876500011',
  'b0000000-0000-0000-0000-000000000003/reject-path.webp',
  '[{"component_id":"bbbbbbbb-0000-0000-0000-00000000000a","qty":1}]'::jsonb);

set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Proj SQ-C"}'::jsonb, 'C', '9876500012',
  'b0000000-0000-0000-0000-000000000004/cancel-path.webp',
  '[{"component_id":"bbbbbbbb-0000-0000-0000-00000000000a","qty":1}]'::jsonb);

-- Approve path.
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}';
select approve_request(
  (select id from requests where requester_id = 'b0000000-0000-0000-0000-000000000002'),
  '[{"component_id":"bbbbbbbb-0000-0000-0000-00000000000a","approved_qty":1}]'::jsonb
);

-- Reject path.
select reject_request(
  (select id from requests where requester_id = 'b0000000-0000-0000-0000-000000000003'),
  'not eligible'
);

-- Cancel path (owner cancels their own pending request).
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":true}';
select cancel_request((select id from requests where requester_id = 'b0000000-0000-0000-0000-000000000004'));

-- Drop back to the unrestricted session role for every direct table check
-- below — storage_cleanup_queue has no policies at all, so even a check
-- that expects a specific count must not run as 'authenticated'.
reset role;

select is(
  (select count(*)::int from storage_cleanup_queue where path = 'b0000000-0000-0000-0000-000000000002/approve-path.webp'),
  1,
  'approving a request enqueues exactly one cleanup row'
);
select is(
  (select count(*)::int from storage_cleanup_queue where path = 'b0000000-0000-0000-0000-000000000003/reject-path.webp'),
  1,
  'rejecting a request enqueues exactly one cleanup row'
);
select is(
  (select count(*)::int from storage_cleanup_queue where path = 'b0000000-0000-0000-0000-000000000004/cancel-path.webp'),
  1,
  'cancelling a request enqueues exactly one cleanup row'
);

-- A repeated status transition touching the same path must not duplicate
-- the queue row (on conflict (path) do nothing). Bypass the RPCs (which
-- would refuse a second transition anyway) to exercise the trigger
-- directly: push the already-rejected request on to 'cancelled' too.
update requests set status = 'cancelled'
  where requester_id = 'b0000000-0000-0000-0000-000000000003';
select is(
  (select count(*)::int from storage_cleanup_queue where path = 'b0000000-0000-0000-0000-000000000003/reject-path.webp'),
  1,
  'a second status transition over the same path does not duplicate the queue row'
);

select is(
  (select count(*)::int from storage_cleanup_queue),
  3,
  'exactly three cleanup rows were queued in total'
);

-- Clients have no access to the queue table at all (no RLS policies, no grants).
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}';
select throws_like(
  $$select count(*) from storage_cleanup_queue$$,
  'permission denied%',
  'a client cannot select from storage_cleanup_queue'
);

select * from finish();
rollback;
