# Go-live checklist

Steps to take in the Supabase dashboard / DNS before pointing real users at
this project. None of this is automated by the repo — check each box by hand
against your cloud project.

## Auth

- [ ] **Turnstile enabled.** Authentication → Settings → Bot and Abuse
      Protection: enable Turnstile, paste the site key and secret key from
      your Cloudflare dashboard. (Local dev leaves this off — see the
      commented `[auth.captcha]` block in `supabase/config.toml`.)
- [ ] **Anonymous sign-ins on.** Authentication → Settings → "Allow anonymous
      sign-ins" enabled (mirrors `enable_anonymous_sign_ins = true` in
      config.toml). Every client device signs in anonymously; there is no
      email/password flow for clients.
- [ ] **Email sign-ups off.** Authentication → Settings → "Allow new user
      signups" disabled (mirrors `enable_signup = false`). Staff accounts are
      the only accounts with emails, and they're created only via
      `create-staff` (see below), never self-signup.
- [ ] **Production domain added** to both: Turnstile's allowed hostnames
      (Cloudflare dashboard), and Supabase Auth's Site URL / Additional
      Redirect URLs (Authentication → URL Configuration).

## Scheduled jobs (pg_cron)

- [ ] `expire-stale-approvals` present — created by migration
      `0008_cron_and_realtime.sql`, runs hourly, releases reserved stock on
      approvals past `expires_at`. Confirm with:
      ```sql
      select jobname, schedule from cron.job;
      ```
- [ ] `cleanup-screenshots` present — **not** a migration, scheduled by
      manually running `supabase/schedule_cleanup.sql` once in the SQL
      editor after deploying the function (see that file's header comment
      for the exact steps: deploy the function, set `CLEANUP_SECRET`,
      replace the project ref and secret placeholders, run it).

## Edge functions

- [ ] `create-staff` deployed, `CLEANUP_SECRET` not required for it (it
      checks the caller's JWT is an active admin instead — see
      `[functions.create-staff]` / `verify_jwt = true` in config.toml).
- [ ] `cleanup-screenshots` deployed with `verify_jwt = false` (it checks the
      `x-cron-secret` header itself) and its `CLEANUP_SECRET` secret set:
      ```bash
      supabase functions deploy create-staff
      supabase functions deploy cleanup-screenshots --no-verify-jwt
      supabase secrets set CLEANUP_SECRET=<a-long-random-string>
      ```
- [ ] First admin created. There's no bootstrap UI — the first staff account
      has to be inserted directly (e.g. via the SQL editor, matching how
      `create-staff` creates subsequent ones) or by invoking `create-staff`
      with a temporary service-role call. Do this once, then create every
      other staff account through `create-staff` from the admin UI.
- [ ] Remaining staff accounts created through `create-staff` (admin-only
      edge function), not by hand.

## Storage

- [ ] `screenshots` bucket exists, private (`public = false`), 1MB file size
      limit, `image/webp|jpeg|png` only — all set by migration
      `0004_storage.sql`; re-confirm in Storage → screenshots → Settings
      since bucket settings aren't re-applied by re-running a migration that
      already ran.

## Email

- [ ] Custom SMTP: **not required.** No part of this app sends email
      (no password reset / magic link flows — staff sign in with a password
      set by `create-staff`, clients never get email). The default Supabase
      SMTP's low rate limit is a non-issue.

## Database

- [ ] **Backups enabled** for the project (Settings → Database → Backups).
      Note your plan's retention window and point-in-time-recovery
      availability — the Free plan has no PITR and short daily-backup
      retention; upgrade if the data is worth more than that window.

## Rollback

- **Frontend:** redeploy the previous build (keep the last known-good build
  artifact or redeploy the previous git commit/tag through your host).
- **Database:** migrations are forward-only — there is no down-migration.
  To undo a bad migration, write a new migration that reverses the specific
  change (e.g. `drop index`, `alter table ... drop column`) rather than
  editing or removing the migration file that shipped it.

## Done when

- [ ] Turnstile site key/secret set and tested (a real Turnstile challenge
      appears and passes on the deployed domain).
- [ ] Anonymous sign-ins succeed, email sign-ups are rejected, on the
      deployed domain.
- [ ] `select jobname from cron.job;` shows both `expire-stale-approvals`
      and `cleanup-screenshots`.
- [ ] Both edge function secrets are set and a manual `curl` to
      `cleanup-screenshots` (per its header-comment instructions) returns
      success.
- [ ] One admin can sign in and create a second staff account from the UI.
- [ ] Backups are confirmed enabled in the dashboard.
