-- RLS: cross-client isolation, anon-role denial, components hidden from
-- clients, and role gating on staff-only RPCs.
begin;
create extension if not exists pgtap;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('99999999-9999-9999-9999-999999999991', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-f@test.local'),
  ('99999999-9999-9999-9999-999999999992', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-g@test.local'),
  ('99999999-9999-9999-9999-999999999993', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'im-only@test.local');

insert into staff (user_id, role) values ('99999999-9999-9999-9999-999999999993', 'inventory_manager');

insert into components (id, name, location, count, reserved) values
  ('aaaaaaaa-0000-0000-0000-000000000020', 'Breadboard', 'Bin E1', 50, 0);

-- Client F submits a request.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"99999999-9999-9999-9999-999999999991","role":"authenticated","is_anonymous":true}';
select submit_request(null, '{"name":"Proj F"}'::jsonb, 'Fay', '9876500005',
  '99999999-9999-9999-9999-999999999991/s.png',
  '[{"component_id":"aaaaaaaa-0000-0000-0000-000000000020","qty":3}]'::jsonb);

select is(
  (select count(*) from requests)::int, 1,
  'client F can see their own request'
);

-- Client G should not see client F's request or items.
set local "request.jwt.claims" to '{"sub":"99999999-9999-9999-9999-999999999992","role":"authenticated","is_anonymous":true}';
select is(
  (select count(*) from requests)::int, 0,
  'client G cannot see client F''s request'
);
select is(
  (select count(*) from request_items)::int, 0,
  'client G cannot see client F''s request items'
);

-- Client G cannot read components directly (only the component_catalog view).
select is(
  (select count(*) from components)::int, 0,
  'a client gets zero rows reading components directly (RLS blocks it)'
);
select is(
  (select location from component_catalog limit 1),
  null,
  'component_catalog never exposes location'
);
select is(
  (select available from component_catalog where id = 'aaaaaaaa-0000-0000-0000-000000000020'),
  50,
  'component_catalog exposes available = count - reserved'
);

-- anon role has no grants on requests at all (revoked in 0003), so it cannot
-- query the table whatsoever, not even to get zero rows back.
set local role anon;
select throws_like(
  $$select count(*) from requests$$,
  'permission denied%',
  'anon role has no access to requests at all'
);

-- Non-admin (inventory_manager) cannot approve.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"99999999-9999-9999-9999-999999999993","role":"authenticated","is_anonymous":false}';
select throws_like(
  $$select approve_request((select id from requests limit 1), '[]'::jsonb)$$,
  'E_FORBIDDEN%',
  'inventory_manager cannot approve_request (admin only)'
);

-- A plain client (non-staff) cannot approve either.
set local "request.jwt.claims" to '{"sub":"99999999-9999-9999-9999-999999999991","role":"authenticated","is_anonymous":true}';
select throws_like(
  $$select approve_request((select id from requests limit 1), '[]'::jsonb)$$,
  'E_FORBIDDEN%',
  'non-staff client cannot approve_request'
);

select * from finish();
rollback;
