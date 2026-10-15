-- update_component: role gate, duplicate detection, returnable guard,
-- count untouched, audit rows.
begin;
create extension if not exists pgtap;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email) values
  ('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-uc@test.local'),
  ('f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-uc@test.local');
insert into staff (user_id, role, display_name) values
  ('f0000000-0000-0000-0000-000000000001', 'admin', 'UC Admin');

insert into components (id, name, location, count, reserved, description, returnable) values
  ('f1000000-0000-0000-0000-000000000001', 'Edit Me', 'Bin E1', 10, 2, 'old', true),
  ('f1000000-0000-0000-0000-000000000002', 'Other Part', 'Bin E2', 5, 0, null, true);

-- An issued request with 1 unit outstanding of "Edit Me".
insert into projects (id, name, phone, created_by)
values ('f2000000-0000-0000-0000-000000000001', 'UC Project', '9876500077', 'f0000000-0000-0000-0000-000000000002');
insert into requests (id, project_id, requester_id, requester_name, phone, status)
values ('f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000002', 'UC Client', '9876500077', 'issued');
insert into request_items (request_id, component_id, qty, approved_qty, issued_qty, returned_qty)
values ('f3000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 1, 1, 1, 0);

-- Client: forbidden.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}';
select throws_like(
  $$select update_component('f1000000-0000-0000-0000-000000000001', '{"description":"hax"}'::jsonb)$$,
  'E_FORBIDDEN%', 'client cannot call update_component'
);

-- Admin.
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}';

select update_component('f1000000-0000-0000-0000-000000000001', '{"description":"  new desc  ","location":"Bin E9"}'::jsonb, 'fix');
select is(
  (select description from components where id = 'f1000000-0000-0000-0000-000000000001'), 'new desc',
  'description updated and trimmed'
);
select is(
  (select count from components where id = 'f1000000-0000-0000-0000-000000000001'), 10,
  'count is untouched'
);
select is(
  (select changes->'location'->>'old' from component_edits where component_id = 'f1000000-0000-0000-0000-000000000001'),
  'Bin E1', 'edit is audited with old value'
);
select is(
  (select updated_by from components where id = 'f1000000-0000-0000-0000-000000000001'),
  'f0000000-0000-0000-0000-000000000001'::uuid, 'updated_by is recorded'
);

select throws_like(
  $$select update_component('f1000000-0000-0000-0000-000000000001', '{"name":"other part","location":"bin e2"}'::jsonb)$$,
  'E_DUPLICATE%', 'case-insensitive duplicate (name, location) is rejected'
);
select throws_like(
  $$select update_component('f1000000-0000-0000-0000-000000000001', '{"returnable":false}'::jsonb)$$,
  'E_RETURNABLE_OUTSTANDING%', 'cannot go non-returnable while units are outstanding'
);
select throws_like(
  $$select update_component('f1000000-0000-0000-0000-000000000001', '{"count":99}'::jsonb)$$,
  'E_INVALID_INPUT%', 'count is not an editable field'
);
select throws_like(
  $$select update_component('f1000000-0000-0000-0000-000000000001', '{"name":"   "}'::jsonb)$$,
  'E_INVALID_INPUT%', 'blank name is rejected'
);
select throws_like(
  $$select update_component('f1000000-0000-0000-0000-0000000000ff', '{"name":"x"}'::jsonb)$$,
  'E_NOT_FOUND%', 'unknown component is E_NOT_FOUND'
);

-- No-op edit writes no audit row.
select update_component('f1000000-0000-0000-0000-000000000001', '{"description":"new desc"}'::jsonb);
select is(
  (select count(*)::int from component_edits where component_id = 'f1000000-0000-0000-0000-000000000001'), 1,
  'a no-op edit adds no audit row'
);

-- Returnable guard lifts once the unit is back.
reset role;
update request_items set returned_qty = 1 where request_id = 'f3000000-0000-0000-0000-000000000001';
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}';
select update_component('f1000000-0000-0000-0000-000000000001', '{"returnable":false}'::jsonb);
select is(
  (select returnable from components where id = 'f1000000-0000-0000-0000-000000000001'), false,
  'returnable can be cleared once nothing is outstanding'
);

select * from finish();
rollback;
