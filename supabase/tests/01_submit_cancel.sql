-- submit_request -> cancel_request happy path, and the E_NOT_CANCELLABLE guard.
begin;
create extension if not exists pgtap;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-a@test.local');

insert into components (id, name, location, count, reserved)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Resistor 10k', 'Bin A1', 100, 0);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":true}';

select lives_ok(
  $$select submit_request(
    null,
    '{"name":"Robo Club","description":"d","owner_name":"Alice"}'::jsonb,
    'Alice',
    '9876543210',
    '11111111-1111-1111-1111-111111111111/screenshot.png',
    '[{"component_id":"aaaaaaaa-0000-0000-0000-000000000001","qty":5}]'::jsonb
  )$$,
  'submit_request succeeds for a new project'
);

select is(
  (select status from requests where requester_id = '11111111-1111-1111-1111-111111111111'),
  'pending'::request_status,
  'request starts pending'
);

select lives_ok(
  $$select cancel_request((select id from requests where requester_id = '11111111-1111-1111-1111-111111111111'))$$,
  'owner can cancel a pending request'
);

select is(
  (select status from requests where requester_id = '11111111-1111-1111-1111-111111111111'),
  'cancelled'::request_status,
  'request is cancelled'
);

select throws_like(
  $$select cancel_request((select id from requests where requester_id = '11111111-1111-1111-1111-111111111111'))$$,
  'E_NOT_CANCELLABLE%',
  'cancelling an already-cancelled request raises E_NOT_CANCELLABLE'
);

select * from finish();
rollback;
