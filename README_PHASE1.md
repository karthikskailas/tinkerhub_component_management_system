# Phase 1 — Database Foundation

Supabase backend for the Electronic Components Inventory System: schema,
RLS, RPCs, one edge function, pgTAP tests. The repo root is also a Vite +
React + TypeScript app (scaffolded, no UI yet — that's Phase 2) wired up to
talk to this backend.

## Local dev

```bash
npm install
cp .env.example .env         # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                  # Vite dev server
supabase start                # local Postgres + Studio (separate terminal, requires Docker)
npm run db:types              # regenerate src/types/database.types.ts from the local schema
```

`src/lib/supabase.ts` exports the typed Supabase client and throws at
startup if either env var is missing. `supabase start` must be running
before `db:types` can introspect the schema.

## Local setup

```bash
supabase init           # already done — supabase/ exists
supabase start          # requires Docker; brings up local Postgres + Studio
supabase test db        # runs the pgTAP suite in supabase/tests/
```

`supabase start` applies every migration in `supabase/migrations/` in order
to a fresh local database, so this is also how you validate the migrations
apply cleanly before pushing.

## Deploying to the cloud (you run these, not Claude)

```bash
supabase link --project-ref <your-project-ref>
supabase db push                       # applies supabase/migrations/*
supabase functions deploy create-staff
```

Then bootstrap the first admin — see `supabase/seed_first_admin.sql` (create
the user in the Dashboard, then insert their row into `staff` by hand).

## Dashboard settings to check after pushing

- **Authentication > Providers > Email**: "Allow new users to sign up"
  should be **off** (public self-signup stays disabled; only the
  `create-staff` function creates accounts).
- **Authentication > Settings**: Anonymous sign-ins **on**. Phone/SMS and
  every OTP/magic-link/OAuth provider **off** — only email+password for
  staff and anonymous sign-in for clients are used.
- **Authentication > Settings > Bot and Abuse Protection**: enable
  Cloudflare Turnstile and fill in the site/secret keys (the config.toml
  `[auth.captcha]` block is commented out on purpose — this is a cloud-only
  setting you configure directly in the dashboard).
- **Database > Extensions**: confirm `pg_cron` and `pgcrypto` are enabled
  (the migrations create them, but some plans require enabling pg_cron from
  the dashboard first).
- **Database > Cron Jobs**: confirm the `expire-stale-approvals` job
  (hourly) is listed and running.
- **Edge Functions > create-staff**: confirm `verify_jwt` is on and the
  `SUPABASE_SERVICE_ROLE_KEY` secret is set (it's available by default in
  every Supabase project's function environment).

## First admin bootstrap

1. Dashboard → Authentication → Users → **Add user** (email + password,
   Auto Confirm checked).
2. Copy the new user's UUID.
3. Run `supabase/seed_first_admin.sql`'s insert statement (with that UUID)
   in the SQL editor.
4. That admin can now sign in (email+password) and call `create-staff` to
   create every other admin/inventory_manager account.

## RPC reference

### Client RPCs (`0005_rpc_client.sql`)

| Function | Role | Params | Errors |
|---|---|---|---|
| `find_projects` | any authenticated (incl. anonymous) | `p_phone text` | `E_INVALID_PHONE`, `E_RATE_LIMIT` |
| `submit_request` | any authenticated | `p_project_id uuid, p_new_project jsonb, p_requester_name text, p_phone text, p_screenshot_path text, p_items jsonb` | `E_INVALID_PHONE`, `E_INVALID_INPUT`, `E_INVALID_SCREENSHOT`, `E_INVALID_ITEMS`, `E_TOO_MANY_ITEMS`, `E_DUPLICATE_ITEM`, `E_TOO_MANY_OPEN_REQUESTS`, `E_PROJECT_NOT_FOUND` |
| `cancel_request` | owner | `p_request_id uuid` | `E_NOT_CANCELLABLE` |
| `get_request_by_token` | any authenticated | `p_token text` | `E_NOT_FOUND` |
| `resubmit_request` | owner | `p_old_request_id uuid` | `E_NOT_FOUND` |

### Staff RPCs (`0006_rpc_staff.sql`)

| Function | Role | Params | Errors |
|---|---|---|---|
| `approve_request` | admin | `p_request_id uuid, p_items jsonb` (`[{component_id, approved_qty}]`) | `E_FORBIDDEN`, `E_NOT_FOUND`, `E_INVALID_STATUS`, `E_INVALID_ITEMS`, `E_STOCK` |
| `reject_request` | admin | `p_request_id uuid, p_reason text` | `E_FORBIDDEN`, `E_INVALID_INPUT`, `E_INVALID_STATUS` |
| `admin_cancel_request` | admin | `p_request_id uuid, p_reason text` | `E_FORBIDDEN`, `E_NOT_FOUND`, `E_INVALID_STATUS` |
| `issue_request` | admin or inventory_manager | `p_request_id uuid, p_items jsonb default null` (`[{component_id, issued_qty}]`) | `E_FORBIDDEN`, `E_NOT_FOUND`, `E_INVALID_STATUS`, `E_EXPIRED`, `E_INVALID_ITEMS` |
| `verify_return` | admin or inventory_manager | `p_request_id uuid, p_items jsonb` (`[{component_id, returned_qty, condition, note}]`) | `E_FORBIDDEN`, `E_NOT_FOUND`, `E_INVALID_STATUS`, `E_INVALID_ITEMS` |

### Inventory RPCs (`0007_inventory_rpc.sql`)

| Function | Role | Params | Errors |
|---|---|---|---|
| `preview_inventory_upload` | staff | `p_rows jsonb` (`[{name, location, count, description, returnable}]`) | `E_FORBIDDEN` (returns per-row diffs, never raises for invalid rows) |
| `commit_inventory_upload` | staff | `p_rows jsonb, p_reason text` | `E_FORBIDDEN` |
| `adjust_component` | staff | `p_component_id uuid, p_new_count int, p_reason text` | `E_FORBIDDEN`, `E_INVALID_INPUT`, `E_NOT_FOUND`, `E_STOCK` |

All RPCs are `security definer`, schema-qualified internally, revoked from
`public`/`anon`, and granted to `authenticated` only. `list_*` helpers were
intentionally not built — the frontend reads `requests`/`request_items`/etc.
directly under RLS with its own pagination.

## Edge function

`create-staff` (POST `{ email, password, role, display_name }`): verifies
the caller is an active admin (service-role lookup against `staff`),
rejects anonymous callers, creates the auth user, inserts the `staff` row,
and rolls back the auth user if that insert fails. Returns
`{ user_id, email, role }`, never the password.

## Staff auth (frontend, Phase 3a)

`/admin/*` has its own React login page (email + password only — no
sign-up, OTP, magic link, or OAuth) and a `RequireStaff` route guard that
checks for an active row in `staff`. **This guard is UI-only, for
navigation/UX — it is never the real security boundary.** The actual
enforcement is, and must stay, in Postgres:

- RLS policies (`0003_helpers_and_rls.sql`) decide what every role can
  `SELECT`.
- Every staff RPC (`approve_request`, `issue_request`, `verify_return`,
  the inventory upload functions, etc.) re-checks `is_admin()`/`is_staff()`
  itself and raises `E_FORBIDDEN` if the caller isn't allowed, regardless
  of what the UI let them click.

A bug in `RequireStaff` can at worst show someone a page they can't
actually do anything on — it can never grant a database write the RLS/RPC
layer wouldn't already allow.

## Assumptions

Ambiguities in the spec were resolved as follows:

- **`approved_qty` cap**: capped at the originally requested `qty` per line
  (approving more than was asked for didn't make sense); 0 is allowed to
  drop a line as specified.
- **`issue_request` reserved release**: issuing a line releases the full
  `approved_qty` from `reserved` (not just the unissued remainder), since
  that reservation is fully resolved once a decision (issue some amount, or
  not) is made — count only drops by the actually-issued quantity.
- **`verify_return` idempotency**: once a line's `returned_qty` is set
  (not null), later calls for that same request/component are silently
  skipped rather than re-validated against a new payload — this is the
  simplest way to guarantee "never double-add" across repeated calls.
- **`admin_cancel_request` reason**: stored only in the `request_events`
  note, since there's no separate cancel-reason column on `requests`
  (`reject_reason` is reserved for actual rejections).
- **Inventory upload matching**: name+location matching for the diff is
  case-insensitive, but the actual insert/update always writes the sheet's
  display casing; updates are applied by the matched row's `id` (not a
  case-sensitive `ON CONFLICT`) so a casing change in the sheet updates the
  existing row instead of silently failing to match it.
- **`find_projects` rate limit**: implemented as a small `rate_limits`
  table with a 10-minute sliding window per `uid`, capped at 20 calls, as a
  lightweight alternative to a dedicated rate-limiting extension.
- **Phone normalization**: last 10 digits of whatever digits remain after
  stripping all non-digit characters (handles `+91`, spaces, dashes).
- **`request_events.actor_id`**: nullable, and left `null` for the
  system-driven `expire_stale_approvals` event (no human actor).
- **Realtime `replica identity`**: left at `DEFAULT` rather than `FULL` —
  the frontend only needs to know a row changed and its current/new values
  (available via the primary key + a refetch, or the `NEW` row realtime
  already sends on UPDATE), not the pre-update values, so `FULL` isn't
  needed.
