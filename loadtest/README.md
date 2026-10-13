# Load test

`k6-requests.js` simulates the client request flow — anonymous sign-in,
browsing `component_catalog`, submitting a request via `submit_request`, and
polling its status — against a Supabase project.

## Before you run it

- **Use a disposable test Supabase project, never production.** The script
  creates real anonymous users, a storage object, a project and a request
  per iteration.
- Install k6: https://k6.io/docs/get-started/installation/
- Get the test project's URL and anon key (Project Settings → API). Do not
  use a service-role or staff key anywhere — the script only needs the same
  anon key the client app ships with.

## Running it

```bash
SUPABASE_URL=https://your-test-project.supabase.co \
SUPABASE_ANON_KEY=your-anon-key \
k6 run loadtest/k6-requests.js
```

This defaults to a safe 10 virtual users for 1 minute. To approximate the
~50 concurrent users this is sized for (test project only):

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... VUS=50 DURATION=5m \
k6 run loadtest/k6-requests.js
```

## What to watch

- k6's own summary: `http_req_duration` p95 and `http_req_failed` rate
  (the script also fails its built-in thresholds if these slip).
- The Supabase dashboard for the test project: API/RPC latency, database
  CPU and connection count, and storage request volume, while the test runs.

## Pass criteria

- p95 request latency under 800ms.
- Error rate under 1%.
- No sustained CPU saturation or connection-pool exhaustion on the
  dashboard during the run.

If any of these fail, check the slow step first (catalog read, RPC, or
storage upload) via the per-request breakdown k6 prints, and whether the
relevant index from `supabase/migrations/0013_indexes.sql` is actually being
used (`explain analyze` the query on the test project).
