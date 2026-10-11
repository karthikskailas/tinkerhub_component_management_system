-- approve_request: stock contention on the last unit, reduced approved_qty,
-- and admin_cancel_request releasing reserved stock.
begin;
create extension if not exists pgtap;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email) values
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-b@test.local'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-c@test.local');

insert into staff (user_id, role) values ('22222222-2222-2222-2222-222222222222', 'admin');

insert into components (id, name, location, count, reserved) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Arduino Uno', 'Bin B1', 1, 0),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'LED Red', 'Bin C1', 10, 0);

-- Client B requests the last Arduino Uno.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Proj B"}'::jsonb, 'Bob', '9876500001',
  '33333333-3333-3333-3333-333333333333/s.png',
  '[{"component_id":"aaaaaaaa-0000-0000-0000-000000000002","qty":1},{"component_id":"aaaaaaaa-0000-0000-0000-000000000003","qty":4}]'::jsonb);

-- Client C requests the same last Arduino Uno.
set local "request.jwt.claims" to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Proj C"}'::jsonb, 'Cara', '9876500002',
  '44444444-4444-4444-4444-444444444444/s.png',
  '[{"component_id":"aaaaaaaa-0000-0000-0000-000000000002","qty":1}]'::jsonb);

set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":false}';

-- Admin approves B's request first: full qty on Arduino, reduced qty (2 of 4) on LED.
select lives_ok(
  $$select approve_request(
    (select id from requests where requester_id = '33333333-3333-3333-3333-333333333333'),
    '[{"component_id":"aaaaaaaa-0000-0000-0000-000000000002","approved_qty":1},{"component_id":"aaaaaaaa-0000-0000-0000-000000000003","approved_qty":2}]'::jsonb
  )$$,
  'first approval on the last unit succeeds'
);

select is(
  (select reserved from components where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  1,
  'Arduino reserved count is 1 after full approval'
);

select is(
  (select reserved from components where id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  2,
  'LED reserved reflects the reduced approved_qty (2, not the requested 4)'
);

-- Admin tries to approve C's request for the same (now unavailable) unit.
select throws_like(
  $$select approve_request(
    (select id from requests where requester_id = '44444444-4444-4444-4444-444444444444'),
    '[{"component_id":"aaaaaaaa-0000-0000-0000-000000000002","approved_qty":1}]'::jsonb
  )$$,
  'E_STOCK%',
  'second approval on the same last unit fails with E_STOCK'
);

-- admin_cancel_request on the approved request releases reserved stock.
select lives_ok(
  $$select admin_cancel_request((select id from requests where requester_id = '33333333-3333-3333-3333-333333333333'), 'test cancel')$$,
  'admin_cancel_request on an approved request succeeds'
);

select is(
  (select reserved from components where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0,
  'Arduino reserved released back to 0 after admin_cancel_request'
);

select is(
  (select reserved from components where id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  0,
  'LED reserved released back to 0 after admin_cancel_request'
);

select * from finish();
rollback;
