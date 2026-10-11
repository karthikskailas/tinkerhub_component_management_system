-- preview_inventory_upload / commit_inventory_upload: diff correctness, the
-- reserved-stock guard, and that missing rows are never deleted.
begin;
create extension if not exists pgtap;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin3@test.local');
insert into staff (user_id, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin');

insert into components (id, name, location, count, reserved, description) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Capacitor 100uF', 'Bin F1', 40, 10, 'old desc'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Keep Me', 'Bin F2', 5, 0, 'should survive untouched upload');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}';

-- Preview: one new row, one changed row (count+description), one invalid
-- (new count below reserved). "Keep Me" is intentionally absent from the sheet.
select results_eq(
  $$select diff::text from preview_inventory_upload('[
    {"name":"Capacitor 100uF","location":"Bin F1","count":60,"description":"new desc"},
    {"name":"New Transistor","location":"Bin F3","count":25,"description":"d"},
    {"name":"Capacitor 100uF","location":"Bin F1","count":5,"description":"too low"}
  ]'::jsonb) order by row_name, new_count$$,
  $$values ('invalid'), ('changed'), ('new')$$,
  'preview classifies changed/new/invalid rows correctly'
);

select is(
  (select error from preview_inventory_upload(
    '[{"name":"Capacitor 100uF","location":"Bin F1","count":5,"description":"too low"}]'::jsonb
  ) limit 1),
  'E_STOCK: new count 5 is below reserved 10',
  'a count below reserved is reported as invalid with the reserved number'
);

-- Commit only the valid rows (new + changed).
select commit_inventory_upload(
  '[
    {"name":"Capacitor 100uF","location":"Bin F1","count":60,"description":"new desc"},
    {"name":"New Transistor","location":"Bin F3","count":25,"description":"d"}
  ]'::jsonb,
  'test upload'
);

select is((select count from components where name = 'Capacitor 100uF'), 60, 'changed row count applied');
select is((select description from components where name = 'Capacitor 100uF'), 'new desc', 'changed row description applied');
select isnt(
  (select id from components where name = 'New Transistor'), null,
  'new row was inserted'
);
select is(
  (select count(*)::int from components where name = 'Keep Me'), 1,
  'a component missing from the uploaded sheet is never deleted'
);
select is(
  (select count(*)::int from inventory_adjustments where component_id = (select id from components where name = 'Capacitor 100uF')),
  1,
  'exactly one adjustment is logged for the changed count'
);

-- Re-committing the identical payload must be idempotent: no new adjustment row.
select commit_inventory_upload(
  '[{"name":"Capacitor 100uF","location":"Bin F1","count":60,"description":"new desc"}]'::jsonb,
  'repeat upload'
);
select is(
  (select count(*)::int from inventory_adjustments where component_id = (select id from components where name = 'Capacitor 100uF')),
  1,
  'repeating the same upload row does not add a second adjustment (idempotent)'
);

select * from finish();
rollback;
