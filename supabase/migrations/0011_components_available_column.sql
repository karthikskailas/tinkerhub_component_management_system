-- PROPOSED. Phase 4 (inventory stock table) needs server-side filtering and
-- pagination on "available" (Low stock / Out of stock), but `available` is
-- only an expression inside the component_catalog view, not a real column
-- on `components` — PostgREST can't filter on an arbitrary two-column
-- expression (count - reserved) without one. This is purely additive (a
-- generated column mirroring the view's own expression) and changes no
-- existing behavior, RLS, or RPC.
--
-- Numbered 0011, not 0010 — 0009 (projects RLS fix) and 0010 (screenshot
-- cleanup) were already taken by earlier phases.

alter table components
  add column if not exists available int generated always as (count - reserved) stored;

create index if not exists idx_components_available on components (available);
