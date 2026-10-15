-- On-site handover confirmation (migrations 0015/0016): confirm_handover,
-- get_handover_page, reset_handover_confirmation, handover_staff RPCs and the
-- extended issue_request(p_handed_over_by).
begin;
create extension if not exists pgtap;
select plan(22);

insert into auth.users (id, instance_id, aud, role, email) values
  ('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-ho@test.local'),
  ('f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'im-ho@test.local'),
  ('f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-ho@test.local'),
  ('f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2-ho@test.local'),
  ('f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c3-ho@test.local'),
  ('f0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c4-ho@test.local'),
  ('f0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c5-ho@test.local'),
  ('f0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c6-ho@test.local'),
  ('f0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'onsite-ho@test.local');

insert into staff (user_id, role) values
  ('f0000000-0000-0000-0000-000000000001', 'admin'),
  ('f0000000-0000-0000-0000-000000000002', 'inventory_manager');

insert into components (id, name, location, count, reserved, returnable) values
  ('f1000000-0000-0000-0000-000000000001', 'Handover Widget', 'Shelf H1', 100, 0, true);

insert into handover_staff (id, name, designation, active) values
  ('f2000000-0000-0000-0000-000000000001', 'Asha', 'Lab Assistant', true),
  ('f2000000-0000-0000-0000-000000000002', 'Inactive Ian', 'Guard', false);

-- Six borrowers, one request each (a user may only hold 3 open requests).
set local role authenticated;

set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"P1"}'::jsonb, 'Borrower One', '9876500123',
  'f0000000-0000-0000-0000-000000000003/s.png',
  '[{"component_id":"f1000000-0000-0000-0000-000000000001","qty":2}]'::jsonb);
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"P2"}'::jsonb, 'Borrower Two', '9876500124',
  'f0000000-0000-0000-0000-000000000004/s.png',
  '[{"component_id":"f1000000-0000-0000-0000-000000000001","qty":2}]'::jsonb);
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"P3"}'::jsonb, 'Borrower Three', '9876500125',
  'f0000000-0000-0000-0000-000000000005/s.png',
  '[{"component_id":"f1000000-0000-0000-0000-000000000001","qty":2}]'::jsonb);
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000006","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"P4"}'::jsonb, 'Borrower Four', '9876500126',
  'f0000000-0000-0000-0000-000000000006/s.png',
  '[{"component_id":"f1000000-0000-0000-0000-000000000001","qty":2}]'::jsonb);
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000007","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"P5"}'::jsonb, 'Borrower Five', '9876500127',
  'f0000000-0000-0000-0000-000000000007/s.png',
  '[{"component_id":"f1000000-0000-0000-0000-000000000001","qty":2}]'::jsonb);
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000008","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"P6"}'::jsonb, 'Borrower Six', '9876500128',
  'f0000000-0000-0000-0000-000000000008/s.png',
  '[{"component_id":"f1000000-0000-0000-0000-000000000001","qty":2}]'::jsonb);

-- Admin approves R1-R5, rejects R6, cancels R3.
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}';
select approve_request(r.id, '[{"component_id":"f1000000-0000-0000-0000-000000000001","approved_qty":2}]'::jsonb)
from requests r where r.requester_id in (
  'f0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004',
  'f0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000006',
  'f0000000-0000-0000-0000-000000000007');
select reject_request((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000008'), 'not valid');
select admin_cancel_request((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000005'), 'test cancel');

-- Superuser-only setup: capture tokens, snapshot stock, expire R4.
reset role;
create temp table tok as
  select left(r.requester_id::text, 36) as uid, r.public_token as t from requests r;
update requests set expires_at = now() - interval '1 day'
  where requester_id = 'f0000000-0000-0000-0000-000000000006';
create temp table stock_snap as
  select (count::text || '/' || reserved::text) as v from components
  where id = 'f1000000-0000-0000-0000-000000000001';
grant select on tok, stock_snap to authenticated;

-- ============================================================
-- Anonymous on-site user (no staff row): page + confirm on R1 (1-8)
-- ============================================================
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000009","role":"authenticated","is_anonymous":true}';

select is(
  (select get_handover_page((select t from tok where uid = 'f0000000-0000-0000-0000-000000000003'))->>'phone_last4'),
  '0123',
  'handover page masks the phone to its last 4 digits'
);
select is(
  (select (get_handover_page((select t from tok where uid = 'f0000000-0000-0000-0000-000000000003')))::text
          ~* '(9876500123|screenshot|s\.png)'),
  false,
  'handover page leaks no full phone number or screenshot path'
);
select lives_ok(
  $$select confirm_handover((select t from tok where uid = 'f0000000-0000-0000-0000-000000000003'), 'f2000000-0000-0000-0000-000000000001')$$,
  'anonymous on-site user can confirm with an active staff id'
);
select throws_like(
  $$select confirm_handover((select t from tok where uid = 'f0000000-0000-0000-0000-000000000003'), 'f2000000-0000-0000-0000-000000000001')$$,
  'E_ALREADY_CONFIRMED%',
  'second confirmation is refused'
);
select is(
  (select get_handover_page((select t from tok where uid = 'f0000000-0000-0000-0000-000000000003'))->'already_confirmed'->>'by'),
  'Asha (Lab Assistant)',
  'page reports who confirmed, as a name (designation) snapshot'
);
select throws_like(
  $$select confirm_handover((select t from tok where uid = 'f0000000-0000-0000-0000-000000000004'), 'f2000000-0000-0000-0000-000000000002')$$,
  'E_INVALID_INPUT%',
  'inactive staff id is rejected'
);
select throws_like(
  $$select confirm_handover((select t from tok where uid = 'f0000000-0000-0000-0000-000000000004'), null, 'Visitor Vik', null)$$,
  'E_INVALID_INPUT%',
  '"Someone else" requires a designation too'
);
select lives_ok(
  $$select confirm_handover((select t from tok where uid = 'f0000000-0000-0000-0000-000000000004'), null, 'Visitor Vik', 'Security')$$,
  '"Someone else" with name and designation confirms'
);

-- ============================================================
-- Confirmation changed no stock and no status (9-10), as staff
-- ============================================================
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}';
select is(
  (select count::text || '/' || reserved::text from components where id = 'f1000000-0000-0000-0000-000000000001'),
  (select v from stock_snap),
  'confirming a handover changes no stock'
);
select is(
  (select status from requests where requester_id = 'f0000000-0000-0000-0000-000000000003'),
  'approved'::request_status,
  'confirming a handover leaves the request approved'
);

-- ============================================================
-- Unavailable requests (11-15)
-- ============================================================
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000009","role":"authenticated","is_anonymous":true}';
select throws_like(
  $$select confirm_handover((select t from tok where uid = 'f0000000-0000-0000-0000-000000000005'), 'f2000000-0000-0000-0000-000000000001')$$,
  'E_INVALID_STATUS%', 'cancelled request is refused'
);
select throws_like(
  $$select confirm_handover((select t from tok where uid = 'f0000000-0000-0000-0000-000000000006'), 'f2000000-0000-0000-0000-000000000001')$$,
  'E_INVALID_STATUS%', 'expired request is refused'
);
select throws_like(
  $$select get_handover_page((select t from tok where uid = 'f0000000-0000-0000-0000-000000000008'))$$,
  'E_INVALID_STATUS%', 'rejected request has no handover page'
);
select throws_like(
  $$select get_handover_page('no-such-token')$$,
  'E_NOT_FOUND%', 'unknown token raises E_NOT_FOUND'
);

-- Issue R5 (no handed_over_by) and R2 (with one) as the IM: stock math is the same.
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}';
select issue_request((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000007'));
select issue_request((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000004'), null, '  Visitor Vik (Security)  ');

select is(
  (select count from components where id = 'f1000000-0000-0000-0000-000000000001'),
  96,
  'issue_request with and without p_handed_over_by deducts the same stock (100-2-2)'
);
select is(
  (select handed_over_by from requests where requester_id = 'f0000000-0000-0000-0000-000000000004'),
  'Visitor Vik (Security)',
  'handed_over_by is trimmed and stored'
);
select is(
  (select handed_over_by from requests where requester_id = 'f0000000-0000-0000-0000-000000000007'),
  null,
  'handed_over_by stays null when omitted'
);

set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000009","role":"authenticated","is_anonymous":true}';
select throws_like(
  $$select get_handover_page((select t from tok where uid = 'f0000000-0000-0000-0000-000000000007'))$$,
  'E_INVALID_STATUS%', 'issued request has no handover page'
);

-- ============================================================
-- Clients cannot manage confirmations or staff (19-21); staff can reset (22)
-- ============================================================
select throws_like(
  $$select reset_handover_confirmation((select id from requests limit 1), 'because')$$,
  'E_FORBIDDEN%', 'client cannot reset_handover_confirmation'
);
select throws_like(
  $$select add_handover_staff('Mallory', 'Intruder')$$,
  'E_FORBIDDEN%', 'client cannot add_handover_staff'
);
select throws_like(
  $$select set_handover_staff_active('f2000000-0000-0000-0000-000000000001', false)$$,
  'E_FORBIDDEN%', 'client cannot set_handover_staff_active'
);

set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}';
select lives_ok(
  $$select reset_handover_confirmation((select id from requests where requester_id = 'f0000000-0000-0000-0000-000000000003'), 'wrong person')$$,
  'admin can reset a confirmation'
);

select * from finish();
rollback;
