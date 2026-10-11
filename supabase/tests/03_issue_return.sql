-- issue_request (count/reserved math, non-returnable auto-complete) and
-- verify_return (partial-by-line return, idempotent re-verification of an
-- already-finalized line while a sibling line is still outstanding).
begin;
create extension if not exists pgtap;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email) values
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin2@test.local'),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'im@test.local'),
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-d@test.local'),
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-e@test.local');

insert into staff (user_id, role) values
  ('55555555-5555-5555-5555-555555555555', 'admin'),
  ('66666666-6666-6666-6666-666666666666', 'inventory_manager');

-- two returnable items (multimeter, soldering iron) + a non-returnable
-- (consumable) resistor pack
insert into components (id, name, location, count, reserved, returnable) values
  ('aaaaaaaa-0000-0000-0000-000000000010', 'Multimeter', 'Bin D1', 5, 0, true),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'Soldering Iron', 'Bin D3', 5, 0, true),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'Resistor Pack', 'Bin D2', 20, 0, false);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Proj D"}'::jsonb, 'Dan', '9876500003',
  '77777777-7777-7777-7777-777777777777/s.png',
  '[{"component_id":"aaaaaaaa-0000-0000-0000-000000000010","qty":2},{"component_id":"aaaaaaaa-0000-0000-0000-000000000012","qty":1}]'::jsonb);

set local "request.jwt.claims" to '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Proj E"}'::jsonb, 'Eve', '9876500004',
  '88888888-8888-8888-8888-888888888888/s.png',
  '[{"component_id":"aaaaaaaa-0000-0000-0000-000000000011","qty":10}]'::jsonb);

set local "request.jwt.claims" to '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated","is_anonymous":false}';
select approve_request(
  (select id from requests where requester_id = '77777777-7777-7777-7777-777777777777'),
  '[{"component_id":"aaaaaaaa-0000-0000-0000-000000000010","approved_qty":2},{"component_id":"aaaaaaaa-0000-0000-0000-000000000012","approved_qty":1}]'::jsonb
);
select approve_request(
  (select id from requests where requester_id = '88888888-8888-8888-8888-888888888888'),
  '[{"component_id":"aaaaaaaa-0000-0000-0000-000000000011","approved_qty":10}]'::jsonb
);

set local "request.jwt.claims" to '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated","is_anonymous":false}';

-- Issue the returnable request: count drops by issued qty, reserved by approved qty.
select lives_ok(
  $$select issue_request((select id from requests where requester_id = '77777777-7777-7777-7777-777777777777'))$$,
  'inventory_manager can issue an approved request'
);
select is((select count from components where id = 'aaaaaaaa-0000-0000-0000-000000000010'), 3, 'Multimeter count drops by issued qty (5-2=3)');
select is((select count from components where id = 'aaaaaaaa-0000-0000-0000-000000000012'), 4, 'Soldering Iron count drops by issued qty (5-1=4)');
select is((select reserved from components where id = 'aaaaaaaa-0000-0000-0000-000000000010'), 0, 'Multimeter reserved released after issue');
select is(
  (select status from requests where requester_id = '77777777-7777-7777-7777-777777777777'),
  'issued'::request_status,
  'returnable request status is issued'
);

-- Issue the non-returnable request: it should auto-complete straight to 'returned'.
select lives_ok(
  $$select issue_request((select id from requests where requester_id = '88888888-8888-8888-8888-888888888888'))$$,
  'inventory_manager can issue a non-returnable request'
);
select is(
  (select status from requests where requester_id = '88888888-8888-8888-8888-888888888888'),
  'returned'::request_status,
  'non-returnable-only request auto-completes to returned'
);
select is((select count from components where id = 'aaaaaaaa-0000-0000-0000-000000000011'), 10, 'Resistor Pack count drops by issued qty (20-10=10)');

-- Resolve only the Multimeter line first. With the Soldering Iron line
-- still outstanding, the request must stay 'issued', not jump to 'returned'.
select verify_return(
  (select id from requests where requester_id = '77777777-7777-7777-7777-777777777777'),
  '[{"component_id":"aaaaaaaa-0000-0000-0000-000000000010","returned_qty":1,"condition":"ok","note":null}]'::jsonb
);
select is((select count from components where id = 'aaaaaaaa-0000-0000-0000-000000000010'), 4, 'one OK unit returned adds back to count (3+1=4)');
select is(
  (select status from requests where requester_id = '77777777-7777-7777-7777-777777777777'),
  'issued'::request_status,
  'request stays issued while the Soldering Iron line is still outstanding'
);

-- Re-send the already-finalized Multimeter line (must not double-add) while
-- resolving the outstanding Soldering Iron line in the same call.
select verify_return(
  (select id from requests where requester_id = '77777777-7777-7777-7777-777777777777'),
  '[
    {"component_id":"aaaaaaaa-0000-0000-0000-000000000010","returned_qty":1,"condition":"ok","note":null},
    {"component_id":"aaaaaaaa-0000-0000-0000-000000000012","returned_qty":1,"condition":"ok","note":null}
  ]'::jsonb
);
select is((select count from components where id = 'aaaaaaaa-0000-0000-0000-000000000010'), 4, 'repeated verify_return call on an already-finalized line does not double-add');
select is((select count from components where id = 'aaaaaaaa-0000-0000-0000-000000000012'), 5, 'Soldering Iron OK return adds back to count (4+1=5)');
select is(
  (select status from requests where requester_id = '77777777-7777-7777-7777-777777777777'),
  'returned'::request_status,
  'request moves to returned once every returnable line is resolved'
);

select * from finish();
rollback;
