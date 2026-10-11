-- Manual script to schedule the screenshot cleanup edge function. NOT a
-- migration — do not add this to supabase/migrations/ and do not run it
-- automatically; run it once yourself in the SQL editor after deploying
-- the cleanup-screenshots function and setting its secret.
--
-- Steps:
--   1. Deploy the function:
--        supabase functions deploy cleanup-screenshots --no-verify-jwt
--   2. Set the shared secret the function checks against (pick your own
--      random value):
--        supabase secrets set CLEANUP_SECRET=<a-long-random-string>
--   3. Replace <project-ref> below with your project ref (the same one in
--      https://<project-ref>.supabase.co) and <same-secret-as-above> with
--      the exact value you set in step 2, then run this whole script in
--      the SQL editor.

create extension if not exists pg_net;

select cron.schedule(
  'cleanup-screenshots',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/cleanup-screenshots',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<same-secret-as-above>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To test once by hand instead of waiting for the schedule, from your own
-- machine (not the SQL editor):
--
--   curl -X POST \
--     -H "x-cron-secret: <same-secret-as-above>" \
--     -H "Content-Type: application/json" \
--     https://<project-ref>.supabase.co/functions/v1/cleanup-screenshots
--
-- To stop the schedule later:
--   select cron.unschedule('cleanup-screenshots');
