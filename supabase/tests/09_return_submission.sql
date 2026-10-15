-- Student return submission (migration 0017): submit_return,
-- submit_return_by_token, reset_return_submission, list_handover_staff_public.
begin;
create extension if not exists pgtap;
select plan(25);

insert into auth.users (id, instance_id, aud, role, email) values

  ('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u1-rs@test.local'),
  ('f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u2-rs@test.local'),
  ('f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u3-rs@test.local'),
  ('f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u4-rs@test.local'),
  ('f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u5-rs@test.local'),
  ('f0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u6-rs@test.local'),
  ('f0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u7-rs@test.local'),
  ('f0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u8-rs@test.local'),
  ('f0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u9-rs@test.local');


insert into staff (user_id, role) values
  ('f0000000-0000-0000-0000-000000000001', 'admin'),
  ('f0000000-0000-0000-0000-000000000002', 'inventory_manager');

insert into components (id, name, location, count, reserved, returnable) values
  ('f1000000-0000-0000-0000-000000000001', 'Return Widget', 'Shelf R1', 100, 0, true),
  ('f1000000-0000-0000-0000-000000000002', 'Return Resistor', 'Bin R2', 50, 0, false);

insert into handover_staff (id, name, designation, active) values
  ('f2000000-0000-0000-0000-000000000001', 'Asha', 'Lab Assistant', true),
  ('f2000000-0000-0000-0000-000000000002', 'Inactive Ian', 'Guard', false);

set local role authenticated;

set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Owner A"}'::jsonb, 'Owner A', '9876500201',
  'f0000000-0000-0000-0000-000000000003/s.png',
  '[{"component_id":"f1000000-0000-0000-0000-000000000001","qty":2}]'::jsonb);

set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Other B"}'::jsonb, 'Other B', '9876500202',
  'f0000000-0000-0000-0000-000000000004/s.png',
  '[{"component_id":"f1000000-0000-0000-0000-000000000001","qty":2}]'::jsonb);

set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000009","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Lost C"}'::jsonb, 'Lost C', '9876500203',
  'f0000000-0000-0000-0000-000000000009/s.png',
  '[{"component_id":"f1000000-0000-0000-0000-000000000001","qty":2}]'::jsonb);

set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000006","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Eater D"}'::jsonb, 'Eater D', '9876500204',
  'f0000000-0000-0000-0000-000000000006/s.png',
  '[{"component_id":"f1000000-0000-0000-0000-000000000002","qty":2}]'::jsonb);

set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000007","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Waiter E"}'::jsonb, 'Waiter E', '9876500205',
  'f0000000-0000-0000-0000-000000000007/s.png',
  '[{"component_id":"f1000000-0000-0000-0000-000000000001","qty":2}]'::jsonb);

set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000008","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Silent F"}'::jsonb, 'Silent F', '9876500206',
  'f0000000-0000-0000-0000-000000000008/s.png',
  '[{"component_id":"f1000000-0000-0000-0000-000000000001","qty":2}]'::jsonb);

set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}';
select approve_request(r.id, jsonb_build_array(jsonb_build_object('component_id', ri.component_id, 'approved_qty', 2)))
from requests r join request_items ri on ri.request_id = r.id
where r.requester_id in ('f0000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-000000000004','f0000000-0000-0000-0000-000000000009','f0000000-0000-0000-0000-000000000006','f0000000-0000-0000-0000-000000000008');

-- Issue everything except E (stays approved). D is consumable-only, so it auto-completes.
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}';
select issue_request(r.id) from requests r
where r.requester_id in ('f0000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-000000000004','f0000000-0000-0000-0000-000000000009','f0000000-0000-0000-0000-000000000006','f0000000-0000-0000-0000-000000000008');

reset role;
create temp table tok as
  select r.requester_id::text as uid, r.public_token as t from requests r;
create temp table stock_snap as
  select count::text || '/' || reserved::text as v from components where id = 'f1000000-0000-0000-0000-000000000001';
grant select on tok, stock_snap to authenticated;
set local role authenticated;

set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}';
select lives_ok($$select submit_return((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000003'), 'f0000000-0000-0000-0000-000000000003/r1.webp', 'f2000000-0000-0000-0000-000000000001')$$, 'owner submits a return with a staff receiver');
select throws_like($$select submit_return((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000003'), 'f0000000-0000-0000-0000-000000000003/r2.webp', 'f2000000-0000-0000-0000-000000000001')$$, 'E_ALREADY_SUBMITTED%', 'second submission is refused');
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":true}';
select throws_like($$select submit_return((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000003'), 'f0000000-0000-0000-0000-000000000004/r.webp', 'f2000000-0000-0000-0000-000000000001')$$, 'E_FORBIDDEN%', 'another client cannot submit for someone else''s request');
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000007","role":"authenticated","is_anonymous":true}';
select throws_like($$select submit_return((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000007'), 'f0000000-0000-0000-0000-000000000007/r.webp', 'f2000000-0000-0000-0000-000000000001')$$, 'E_INVALID_STATUS%', 'an approved (not issued) request is rejected');
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000006","role":"authenticated","is_anonymous":true}';
select throws_like($$select submit_return((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000006'), 'f0000000-0000-0000-0000-000000000006/r.webp', 'f2000000-0000-0000-0000-000000000001')$$, 'E_INVALID_STATUS%', 'a consumables-only request has no return flow');
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":true}';
select throws_like($$select submit_return((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000004'), 'f0000000-0000-0000-0000-000000000003/r.webp', 'f2000000-0000-0000-0000-000000000001')$$, 'E_INVALID_INPUT%', 'photo path outside the caller''s folder is rejected');
select throws_like($$select submit_return((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000004'), 'f0000000-0000-0000-0000-000000000004/r.webp', 'f2000000-0000-0000-0000-000000000002')$$, 'E_INVALID_INPUT%', 'inactive staff receiver is rejected');
select throws_like($$select submit_return((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000004'), 'f0000000-0000-0000-0000-000000000004/r.webp', null, 'Visitor Vik', null)$$, 'E_INVALID_INPUT%', '"Someone else" needs a designation');
select lives_ok($$select submit_return((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000004'), 'f0000000-0000-0000-0000-000000000004/r.webp', null, 'Visitor Vik', 'Security', 'boxed')$$, '"Someone else" with name and designation submits');
select is((select return_receiver_name || ' (' || return_receiver_designation || ')' from requests where requester_id = 'f0000000-0000-0000-0000-000000000004'), 'Visitor Vik (Security)', 'receiver is stored as a snapshot');
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":true}';
select lives_ok($$select submit_return_by_token((select t from tok where uid = 'f0000000-0000-0000-0000-000000000009'), 'f0000000-0000-0000-0000-000000000005/t.webp', 'f2000000-0000-0000-0000-000000000001')$$, 'token variant works from a fresh session');
select throws_like($$select submit_return_by_token((select t from tok where uid = 'f0000000-0000-0000-0000-000000000009'), 'f0000000-0000-0000-0000-000000000005/t2.webp', 'f2000000-0000-0000-0000-000000000001')$$, 'E_ALREADY_SUBMITTED%', 'token variant refuses a second submission');
select throws_like($$select submit_return_by_token((select t from tok where uid = 'f0000000-0000-0000-0000-000000000008'), 'f0000000-0000-0000-0000-000000000003/t.webp', 'f2000000-0000-0000-0000-000000000001')$$, 'E_INVALID_INPUT%', 'token variant still requires the caller''s own photo folder');
select throws_like($$select submit_return_by_token('no-such-token', 'f0000000-0000-0000-0000-000000000005/t.webp', 'f2000000-0000-0000-0000-000000000001')$$, 'E_NOT_FOUND%', 'token variant: unknown token');
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}';
select throws_like($$select reset_return_submission((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000003'), 'blurry photo')$$, 'E_FORBIDDEN%', 'client cannot reset a submission');
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}';
select is((select count::text || '/' || reserved::text from components where id = 'f1000000-0000-0000-0000-000000000001'), (select v from stock_snap), 'submitting changed no stock');
select is((select status from requests where requester_id = 'f0000000-0000-0000-0000-000000000003'), 'issued'::request_status, 'submitting left the request issued');
select lives_ok($$select reset_return_submission((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000003'), 'photo is unclear')$$, 'inventory manager resets a submission');
select is((select return_submitted_at is null and return_photo_path is null from requests where requester_id = 'f0000000-0000-0000-0000-000000000003'), true, 'reset clears the return columns');
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}';
select lives_ok($$select submit_return((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000003'), 'f0000000-0000-0000-0000-000000000003/r3.webp', 'f2000000-0000-0000-0000-000000000001')$$, 'owner can resubmit after a reset');
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}';
select verify_return((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000003'), jsonb_build_array(jsonb_build_object('component_id', 'f1000000-0000-0000-0000-000000000001', 'returned_qty', 2, 'condition', 'ok', 'note', null)));
select is((select status from requests where requester_id = 'f0000000-0000-0000-0000-000000000003'), 'returned'::request_status, 'verify_return completes a request that had a submission');
select verify_return((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000008'), jsonb_build_array(jsonb_build_object('component_id', 'f1000000-0000-0000-0000-000000000001', 'returned_qty', 2, 'condition', 'ok', 'note', null)));
select is((select status from requests where requester_id = 'f0000000-0000-0000-0000-000000000008'), 'returned'::request_status, 'verify_return completes a request with no submission');
select is((select count from components where id = 'f1000000-0000-0000-0000-000000000001'), 96, 'only verification put stock back (92 + 2 + 2)');
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from list_handover_staff_public()), 1, 'public staff list returns active staff only');
select is((select to_jsonb(s) - 'id' - 'name' - 'designation' from list_handover_staff_public() s limit 1), '{}'::jsonb, 'public staff list exposes only id, name and designation');


select * from finish();
rollback;
