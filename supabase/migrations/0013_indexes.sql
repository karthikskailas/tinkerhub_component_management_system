-- Phase 6 query/index audit. Every index below is named for the specific
-- frontend query (grep `.from(`/`.rpc(` in src/) that needs it; indexes
-- already covered by earlier migrations are called out, not duplicated:
--   - idx_requests_status_created(status, created_at desc) already covers
--     Review's pending/approved lists (both order by created_at).
--   - idx_requests_public_token, idx_projects_phone, idx_request_items_component
--     already cover TokenPage/OpenRequestBanner/find_projects's internal
--     join and request_items-by-component lookups.
--   - idx_request_events_request_created(request_id, created_at) already
--     covers the History timeline query exactly — nothing to add there.

create extension if not exists pg_trgm;

-- Issue tab: requests/api.ts fetchRequestListPage with
-- statuses=['approved'], orderColumn='approved_at' ascending.
create index if not exists idx_requests_status_approved_at on requests (status, approved_at);

-- Returns tab: same function with statuses=['issued'], orderColumn='issued_at'.
create index if not exists idx_requests_status_issued_at on requests (status, issued_at);

-- History tab: same function with orderColumn='updated_at' descending and a
-- multi-value status IN-list, where a single composite (status, updated_at)
-- is less useful than it is for Issue/Returns (one value per call there).
create index if not exists idx_requests_updated_at_id on requests (updated_at desc, id desc);

-- expire_stale_approvals() (0008) runs `where status = 'approved' and
-- expires_at < now()` every hour. idx_requests_status_expires(status,
-- expires_at) from 0002 already makes this correct; this partial index is
-- a size refinement — approved is a transient state, so as requests
-- accumulate in returned/rejected/cancelled/expired over time, a partial
-- index stays tiny while the full composite keeps growing with them.
create index if not exists idx_requests_approved_expiring
  on requests (expires_at)
  where status = 'approved';

-- Issue/Returns/History all search requester_name/phone/request_code with
-- `.ilike('%term%')` (both-sides wildcard) — a plain btree can only
-- accelerate a prefix match, not an arbitrary substring, so these need
-- trigram GIN indexes instead.
create index if not exists idx_requests_requester_name_trgm
  on requests using gin (requester_name gin_trgm_ops);
create index if not exists idx_requests_phone_trgm
  on requests using gin (phone gin_trgm_ops);
create index if not exists idx_requests_request_code_trgm
  on requests using gin (request_code gin_trgm_ops);

-- History's project-name search (requests/api.ts matchingProjectIds) does
-- the same `.ilike('%term%')` against projects.name.
create index if not exists idx_projects_name_trgm
  on projects using gin (name gin_trgm_ops);

-- Inventory's stock table: useComponents.ts orders by (name, id) for
-- keyset pagination, and searches name/location with the same wildcard
-- ilike as above. The same (name, id) index also speeds up the client
-- wizard's component_catalog view, which orders by name with no filter.
create index if not exists idx_components_name_id on components (name, id);
create index if not exists idx_components_name_substr_trgm
  on components using gin (name gin_trgm_ops);
create index if not exists idx_components_location_trgm
  on components using gin (location gin_trgm_ops);

-- Inventory's adjustment history drawer: `.eq('component_id', id)
-- .order('created_at', {ascending:false}).limit(50)` on inventory_adjustments,
-- which otherwise has no index beyond its bare id primary key.
create index if not exists idx_inventory_adjustments_component_created
  on inventory_adjustments (component_id, created_at desc);
