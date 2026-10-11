-- Fixes a genuine RLS gap found in 0003 during Phase 2 (worked around in the
-- frontend at the time rather than editing 0003 directly). Applied.
--
-- Gap: projects_select_owner_or_staff only lets created_by = auth.uid() (or
-- staff) SELECT a project row. But submit_request's "registered project"
-- path (find_projects + p_project_id) is explicitly designed for a SECOND
-- person on the same team/phone number to submit against a project they
-- did not create. That second requester's own /request/:id page cannot
-- read projects directly to show the project name — only the original
-- creator can. The frontend sidesteps this by sourcing the project name
-- from get_request_by_token (security definer, bypasses RLS) instead of a
-- direct `projects` select, which works but means the client can never
-- read a shared project's other fields (description, owner_name) directly
-- if it ever needs to.
--
-- Fix: add an additional (permissive) policy so a requester can also see
-- any project they have an actual request against, regardless of who
-- created it. Multiple permissive policies on the same table are OR'd
-- together by Postgres, so this only widens access, it doesn't need to
-- replace the existing policy.

create policy projects_select_via_request on projects
  for select to authenticated
  using (
    exists (
      select 1 from requests r
      where r.project_id = projects.id and r.requester_id = auth.uid()
    )
  );
