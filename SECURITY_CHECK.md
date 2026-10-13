# Security check (Phase 6)

Checklist for the items in the Phase 6 task. Each item names the exact file
backing it, and whether it's verified by the new pgTAP file
(`supabase/tests/07_security_audit.sql`) or by code review. **I have not
run this suite against a live database this phase** (per standing
instruction not to spin up local Supabase this session) — the SQL was
written and reviewed carefully, but treat it as unverified by execution
until you run `supabase test db` yourself.

## 1. No table readable by `anon`

**Resolved.** `0003_helpers_and_rls.sql` runs a blanket
`revoke all on all tables in schema public from public, anon` before any
grants, and every subsequent `grant select ...` targets `authenticated`
only. `rate_limits` (0005) and `storage_cleanup_queue` (0010) each have
their own explicit `revoke all ... from public, anon, authenticated` too
(no policies exist on either, so authenticated is also blocked, by design —
they're service-role/trigger-only tables).

Verified by `07_security_audit.sql` tests 1–9 (anon gets `permission
denied` on staff, components, projects, requests, request_items,
request_events, inventory_adjustments, rate_limits, storage_cleanup_queue).

## 2. Clients cannot read `components`, `location`, other clients' `request_items`, or staff data

**Resolved.**
- `components`: `components_select_staff` policy is `using (is_staff())` —
  no client branch at all. Verified in `04_rls.sql` ("a client gets zero
  rows reading components directly").
- `location`: never selected by any client-facing query or RPC; the only
  client-readable path to component data is `component_catalog`, which
  doesn't expose it. Verified in `04_rls.sql` (`hasnt_column`).
- `request_items`: `request_items_select_owner_or_staff` is `is_staff() OR
  exists(... r.requester_id = auth.uid())` — isolated by request ownership.
  Verified in `04_rls.sql` ("client G cannot see client F's request items").
- `staff`: `staff_select_self_or_admin` is `user_id = auth.uid() OR
  is_admin()` — a non-admin staff member (inventory_manager) can only read
  their own row, not another staff member's. Newly verified in
  `07_security_audit.sql` test 10.

**One related gap found and already fixed in an earlier phase, noted here
for completeness:** `projects_select_owner_or_staff` only let the row's
*creator* read it, which broke a second requester on the same shared
project reading the project's own name/description directly. Fixed by
`0009_projects_rls_fix.sql` (additive policy: also readable by anyone with
a request against that project). Verified in `07_security_audit.sql` test
11, which confirms the remaining case still holds: a client with **no**
request against the project still can't read it.

## 3. `component_catalog` exposes no location or raw count

**Resolved.** The view (`0003_helpers_and_rls.sql`) selects only `id, name,
description, returnable, (count - reserved) as available` — `location` and
`count` are never in the view's column list at all, not just filtered at
the RLS layer. Verified in `04_rls.sql` (`hasnt_column` for `location`;
there's no `hasnt_column` check for the raw `count`/`reserved` names
specifically, but the view's `select` list in the migration is the
authoritative source — grep `supabase/migrations/0003_helpers_and_rls.sql`
for `create or replace view component_catalog` to confirm directly).

## 4. Every `security definer` function sets `search_path = ''`

**Resolved.** Counted `security definer` vs `set search_path = ''`
occurrences in every migration that defines one — they match exactly in
each file (3/3, 5/5, 5/5, 3/3, 1/1, 1/1 across
0003/0005/0006/0007/0008/0010). No function has one without the other.

## 5. RPCs raise `E_FORBIDDEN` for wrong roles

**Resolved.** Every staff-only RPC (`approve_request`, `reject_request`,
`admin_cancel_request`, `issue_request`, `verify_return`,
`preview_inventory_upload`, `commit_inventory_upload`, `adjust_component`)
starts with `if not is_admin()`/`if not is_staff() then raise exception
'E_FORBIDDEN: ...'` before touching any input. `04_rls.sql` already covered
`approve_request` (both a non-staff client and a non-admin
inventory_manager); `07_security_audit.sql` tests 12–18 cover the
remaining seven.

## 6. Storage policies match the spec

**Resolved.** `0004_storage.sql`: bucket `screenshots` is private
(`public = false`), 1 MB limit, `image/webp|jpeg|png` only. Policies:
insert restricted to the caller's own `{uid}/` folder; select is own-folder
OR staff; delete is staff-only; no update policy at all (uploads are
immutable once submitted, matching the spec note in that file). Verified
behaviorally in `07_security_audit.sql` tests 19–20 (a client reads their
own object; a different client reading the same object gets zero rows).
RLS being enabled on `storage.objects` itself is a Supabase platform
default, not something this project's migrations toggle.

## 7. `create-staff` and `cleanup-screenshots` reject unauthorized callers

**Resolved, verified by code review** (not pgTAP — these are Deno edge
functions, outside what SQL can test):
- `create-staff`: no `Authorization` header → 401. Anonymous caller
  (`user.is_anonymous`) → 403. Authenticated but not an active admin in
  `staff` (service-role lookup) → 403.
- `cleanup-screenshots`: neither `x-cron-secret` matching `CLEANUP_SECRET`
  nor a valid non-anonymous admin JWT → 401 (missing both) or 403 (present
  but wrong). `verify_jwt = false` is intentional (documented in the
  function's own header comment) since the cron path authenticates via the
  shared secret, not a platform-checked JWT — the function enforces auth
  itself either way.

## 8. No secrets in the repo

**Resolved.** Grepped for service-role/secret-key patterns across
`*.ts/*.tsx/*.json/*.env*` — nothing found. `.gitignore` ignores `.env` and
`.env.*` with an explicit `!.env.example` exception. Only `VITE_`-prefixed
variables are read on the client (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY` — all meant to be
public: a project URL, the anon key, which RLS makes safe to expose by
design, and a Turnstile *site* key, not its secret).

## 9. Security headers / CSP

**Added**, `public/_headers` (Netlify/Cloudflare Pages format):
`X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and a CSP
allowing `'self'`, the Supabase project (wildcarded as `https://*.supabase.co`
/ `wss://*.supabase.co` for REST + Realtime), Cloudflare Turnstile's script
+ iframe, and `data:`/`blob:` for images (the QR code and html-to-image
PNG export both use these).

`style-src` needs `'unsafe-inline'` — the component picker and preview
table's virtualizers, and the pickup card's fixed width, all set inline
`style="..."` at runtime, which a stricter `style-src` would block. This is
a standard, accepted trade-off for any React app using inline styles for
dynamic positioning, not a loosened policy for convenience.

**Verified by static analysis, not a live CSP-enforced load**: the
production `dist/index.html` has no inline `<script>` (confirmed by
building and inspecting it — only external `type="module"` and
`modulepreload` tags), so `script-src` needs no `'unsafe-inline'`. I could
not do an actual browser test with these headers enforced from this
environment (`vite preview` doesn't read `public/_headers` — that's
host-specific). **Do a real smoke test once deployed**: open the app,
complete the wizard (screenshot upload/compress, Turnstile if enabled),
and open `/admin/review` and approve something (PickupCard's QR + PNG
export), watching the browser console for any CSP violation reports.

## 10. Admin pages `noindex` + `robots.txt`

**Resolved.** `AdminLayout.tsx` injects `<meta name="robots" content="noindex, nofollow">`
on mount (client-side — Phase 3a). Added `public/robots.txt` disallowing
`/admin` as a second, crawler-respected layer that doesn't depend on JS
running first.

## Open items

None blocking. The CSP's real-browser verification (item 9) is the one
thing to double-check after your first deploy, since it genuinely can't be
tested from here.
