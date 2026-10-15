-- Admin-defined component fields: DDL RPC gate, upload round trip, blank
-- cells never erase, typed validation, update_component, archive.
begin;
create extension if not exists pgtap;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-df@test.local'),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'im-df@test.local');
insert into staff (user_id, role, display_name) values
  ('a1000000-0000-0000-0000-000000000001', 'admin', 'DF Admin'),
  ('a1000000-0000-0000-0000-000000000002', 'inventory_manager', 'DF IM');

insert into components (id, name, location, count) values
  ('a2000000-0000-0000-0000-000000000001', 'Field Part', 'Bin D1', 4);

set local role authenticated;

-- Inventory manager cannot define fields.
set local "request.jwt.claims" to '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}';
select throws_like(
  $$select create_component_field('Part number')$$,
  'E_FORBIDDEN%', 'inventory_manager cannot create_component_field'
);

-- Admin can.
set local "request.jwt.claims" to '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}';
select is(create_component_field('Part number', 'text', 100, true), 'part_number', 'key is derived from the label');
select is(create_component_field('Min stock', 'int'), 'min_stock', 'int field created');
select throws_like(
  $$select create_component_field('Name')$$,
  'E_DUPLICATE%', 'a label colliding with a real column is rejected'
);
select throws_like(
  $$select create_component_field('Bad; drop table', 'blob')$$,
  'E_INVALID_INPUT%', 'unknown type is rejected'
);
select has_column('public', 'components', 'part_number', 'real column was added');

-- Upload round trip.
select commit_inventory_upload(
  '[{"name":"Field Part","location":"Bin D1","count":4,"part_number":"PN-1","min_stock":"3"}]'::jsonb, 'df');
select is(
  (select part_number from components where id = 'a2000000-0000-0000-0000-000000000001'), 'PN-1',
  'custom field round-trips through upload'
);
select is(
  (select min_stock from components where id = 'a2000000-0000-0000-0000-000000000001'), 3,
  'int custom field is stored typed'
);
select is(
  (select diff from preview_inventory_upload(
    '[{"name":"Field Part","location":"Bin D1","count":4,"part_number":"","min_stock":""}]'::jsonb)),
  'unchanged', 'blank custom cells preview as unchanged'
);
select is(
  (select error from preview_inventory_upload(
    '[{"name":"Field Part","location":"Bin D1","count":4,"min_stock":"abc"}]'::jsonb)),
  'E_INVALID: Min stock: invalid value', 'a non-numeric value in an int field is invalid'
);

-- update_component with custom fields; count untouched.
select update_component('a2000000-0000-0000-0000-000000000001', '{"part_number":"PN-2"}'::jsonb);
select is(
  (select part_number from components where id = 'a2000000-0000-0000-0000-000000000001'), 'PN-2',
  'update_component edits a custom field'
);
select is(
  (select changes->'part_number'->>'old' from component_edits
    where component_id = 'a2000000-0000-0000-0000-000000000001'), 'PN-1',
  'custom field edit is audited'
);

-- Archive: field is no longer accepted.
select update_component_field('part_number', null, null, null, true);
select throws_like(
  $$select update_component('a2000000-0000-0000-0000-000000000001', '{"part_number":"PN-3"}'::jsonb)$$,
  'E_INVALID_INPUT%', 'archived field is rejected'
);

select * from finish();
rollback;
