-- PROPOSED. Phase 5 needs to search Issue/Returns/History lists by "request
-- code" (the first 8 hex chars of the id, as already shown throughout the
-- UI, e.g. PickupCard's short_code). `id` is a uuid column, and PostgREST
-- generates a plain `ilike` filter with no cast — `uuid ilike text` doesn't
-- exist as an operator, so searching the raw id column 400s (the exact
-- same class of problem as migration 0011's `available` column: PostgREST
-- can't filter on an expression, only a real column).
--
-- This adds a generated text column mirroring the short code already
-- computed ad hoc in the frontend (upper(left(id::text, 8))), so it can be
-- filtered/indexed like any other column. Purely additive, no RLS/RPC
-- change.
--
-- Numbered 0012 — 0009/0010/0011 were already taken by earlier phases.

alter table requests
  add column if not exists request_code text generated always as (upper(left(id::text, 8))) stored;

create index if not exists idx_requests_request_code on requests (request_code);
