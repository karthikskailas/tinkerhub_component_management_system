-- Security audit (Phase 6): asserts the checklist in SECURITY_CHECK.md
-- actually holds. Complements 04_rls.sql rather than repeating it — this
-- file covers tables/RPCs 04 doesn't touch (staff, projects, request_events,
-- inventory_adjustments, rate_limits, storage_cleanup_queue, storage.objects,
-- and every remaining staff-only RPC's E_FORBIDDEN gate).
begin;
create extension if not exists pgtap;
select plan(35);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-sec@test.local'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'im-sec@test.local'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-sec-a@test.local'),
  ('c0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-sec-b@test.local');

insert into staff (user_id, role, display_name) values
  ('c0000000-0000-0000-0000-000000000001', 'admin', 'Security Admin'),
  ('c0000000-0000-0000-0000-000000000002', 'inventory_manager', 'Security IM');

insert into components (id, name, location, count, reserved) values
  ('d0000000-0000-0000-0000-000000000001', 'Audit Widget', 'Bin Z1', 10, 0);

insert into handover_staff (name, designation) values ('Audit Guard', 'Security');

insert into projects (id, name, phone, created_by) values
  ('e0000000-0000-0000-0000-000000000001', 'Audit Project', '9876500099', 'c0000000-0000-0000-0000-000000000003');

-- Client A submits a request so there's a row to probe isolation against.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}';
select submit_request(
  'e0000000-0000-0000-0000-000000000001', null, 'Client A', '9876500099',
  'c0000000-0000-0000-0000-000000000003/s.png',
  '[{"component_id":"d0000000-0000-0000-0000-000000000001","qty":1}]'::jsonb
);

-- ============================================================
-- anon: zero access to every sensitive table (1-9)
-- ============================================================
set local role anon;
select throws_like($$select count(*) from staff$$, 'permission denied%', 'anon cannot read staff');
select throws_like($$select count(*) from components$$, 'permission denied%', 'anon cannot read components');
select throws_like($$select count(*) from projects$$, 'permission denied%', 'anon cannot read projects');
select throws_like($$select count(*) from requests$$, 'permission denied%', 'anon cannot read requests');
select throws_like($$select count(*) from request_items$$, 'permission denied%', 'anon cannot read request_items');
select throws_like($$select count(*) from request_events$$, 'permission denied%', 'anon cannot read request_events');
select throws_like($$select count(*) from inventory_adjustments$$, 'permission denied%', 'anon cannot read inventory_adjustments');
select throws_like($$select count(*) from rate_limits$$, 'permission denied%', 'anon cannot read rate_limits');
select throws_like($$select count(*) from storage_cleanup_queue$$, 'permission denied%', 'anon cannot read storage_cleanup_queue');

-- ============================================================
-- Non-admin staff cannot read another staff member's row (10)
-- ============================================================
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}';
select is(
  (select count(*)::int from staff where user_id = 'c0000000-0000-0000-0000-000000000001'),
  0,
  'inventory_manager cannot read the admin''s staff row'
);

-- ============================================================
-- A client who didn't create the project cannot read it directly (11)
-- (RLS: projects_select_owner_or_staff is created_by = auth.uid() OR staff)
-- ============================================================
set local "request.jwt.claims" to '{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":true}';
select is(
  (select count(*)::int from projects where id = 'e0000000-0000-0000-0000-000000000001'),
  0,
  'a client who did not create the project cannot read it directly'
);

-- ============================================================
-- E_FORBIDDEN for every remaining staff-only RPC, called by a plain client (12-18)
-- ============================================================
select throws_like(
  $$select reject_request((select id from requests limit 1), 'nope')$$,
  'E_FORBIDDEN%', 'client cannot reject_request'
);
select throws_like(
  $$select admin_cancel_request((select id from requests limit 1), 'nope')$$,
  'E_FORBIDDEN%', 'client cannot admin_cancel_request'
);
select throws_like(
  $$select issue_request((select id from requests limit 1), '[]'::jsonb)$$,
  'E_FORBIDDEN%', 'client cannot issue_request'
);
select throws_like(
  $$select verify_return((select id from requests limit 1), '[]'::jsonb)$$,
  'E_FORBIDDEN%', 'client cannot verify_return'
);
select throws_like(
  $$select * from preview_inventory_upload('[]'::jsonb)$$,
  'E_FORBIDDEN%', 'client cannot preview_inventory_upload'
);
select throws_like(
  $$select commit_inventory_upload('[]'::jsonb, 'x')$$,
  'E_FORBIDDEN%', 'client cannot commit_inventory_upload'
);
select throws_like(
  $$select adjust_component('d0000000-0000-0000-0000-000000000001', 5, 'x')$$,
  'E_FORBIDDEN%', 'client cannot adjust_component'
);

select throws_like(
  $$select update_component('d0000000-0000-0000-0000-000000000001', '{"name":"x"}'::jsonb)$$,
  'E_FORBIDDEN%', 'client cannot update_component'
);
select is(
  (select count(*)::int from component_edits), 0,
  'client sees no component_edits rows (staff read only)'
);

-- ============================================================
-- storage.objects: own-folder select works, another user's folder doesn't
-- (19-20). Bucket/object setup runs as the unrestricted session role —
-- storage.buckets/objects have their own RLS, and neither the "create a
-- bucket" nor the raw "insert a pre-existing object record" step is
-- something a client role has a policy for (that's the point).
-- ============================================================
reset role;
insert into storage.buckets (id, name, public)
  values ('screenshots', 'screenshots', false)
  on conflict (id) do nothing;
insert into storage.objects (bucket_id, name, owner)
values ('screenshots', 'c0000000-0000-0000-0000-000000000003/own.webp', 'c0000000-0000-0000-0000-000000000003');

set local role authenticated;

set local "request.jwt.claims" to '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}';
select is(
  (select count(*)::int from storage.objects where name = 'c0000000-0000-0000-0000-000000000003/own.webp'),
  1,
  'a client can read their own screenshot object'
);

set local "request.jwt.claims" to '{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":true}';
select is(
  (select count(*)::int from storage.objects where name = 'c0000000-0000-0000-0000-000000000003/own.webp'),
  0,
  'a different client cannot read someone else''s screenshot object'
);

-- ============================================================
-- Handover (0015/0016): table, columns, function grants (21-26)
-- ============================================================
select is(
  (select count(*)::int from handover_staff),
  0,
  'a client (non-staff) cannot read handover_staff'
);
select has_column('public', 'requests', 'handover_confirmed_at', 'requests has handover_confirmed_at');
select has_column('public', 'requests', 'handed_over_by', 'requests has handed_over_by');
select is(
  has_function_privilege('anon', 'public.get_handover_page(text)', 'execute')
    or has_function_privilege('anon', 'public.confirm_handover(text, uuid, text, text)', 'execute'),
  false,
  'anon cannot execute the handover RPCs'
);
select is(
  has_function_privilege('authenticated', 'public.check_rate_limit(text, int, int)', 'execute'),
  false,
  'the rate-limit helper is not callable by clients'
);
set local role anon;
select throws_like($$select count(*) from handover_staff$$, 'permission denied%', 'anon cannot read handover_staff');
reset role;

-- ============================================================
-- Return submission (0017): columns, grants, bucket policies (27-33)
-- ============================================================
select has_column('public', 'requests', 'return_submitted_at', 'requests has return_submitted_at');
select has_column('public', 'requests', 'return_photo_path', 'requests has return_photo_path');
select is(
  has_function_privilege('anon', 'public.submit_return(uuid, text, uuid, text, text, text)', 'execute')
    or has_function_privilege('anon', 'public.submit_return_by_token(text, text, uuid, text, text, text)', 'execute')
    or has_function_privilege('anon', 'public.reset_return_submission(uuid, text)', 'execute')
    or has_function_privilege('anon', 'public.list_handover_staff_public()', 'execute'),
  false,
  'anon cannot execute the return-submission RPCs'
);
select is(
  has_function_privilege('authenticated', 'public._submit_return(uuid, text, text, uuid, text, text, text)', 'execute'),
  false,
  'the internal _submit_return implementation is not callable by clients'
);
select throws_like(
  $$select reset_return_submission((select id from requests limit 1), 'nope')$$,
  'E_FORBIDDEN%', 'client cannot reset_return_submission'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('return_photos_insert_own_folder', 'return_photos_select_own_or_staff', 'return_photos_delete_staff')),
  3,
  'return-photos has insert/select/delete policies'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'return_photos%' and cmd in ('UPDATE', 'ALL')),
  0,
  'return-photos has no client update policy'
);

select * from finish();
rollback;
