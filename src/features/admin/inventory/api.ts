import { supabase } from "../../../lib/supabase";
import type { Database } from "../../../types/database.types";

export const PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50];
export const LOW_STOCK_THRESHOLD = 5;

export type StockFilter = "all" | "low" | "out" | "non_returnable";

export interface ComponentRow {
  id: string;
  name: string;
  location: string | null;
  count: number;
  reserved: number;
  available: number;
  returnable: boolean;
  description: string | null;
  image_url: string | null;
  updated_at: string;
  // Admin-defined fields arrive as extra columns keyed by field key.
  [customField: string]: unknown;
}

export interface ComponentsPage {
  rows: ComponentRow[];
  nextCursor: { name: string; id: string } | null;
}

// `available` depends on migration 0011 (a generated column mirroring
// component_catalog's `count - reserved` expression) — see that file for
// why it's needed: PostgREST can't filter/sort on a raw two-column
// expression, only a real column.
const SELECT_COLUMNS = "*";

// name + location always, plus any searchable custom text fields (keys are
// validated snake_case by the backend, so they're safe in the filter string).
function searchClause(escaped: string, searchKeys: string[] = []): string {
  return ["name", "location", ...searchKeys.filter((k) => /^[a-z][a-z0-9_]*$/.test(k))]
    .map((k) => `${k}.ilike.%${escaped}%`)
    .join(",");
}

// Shared by the stock table (50/page) and CSV export (1000/page): builds
// the same search/filter/keyset-cursor query, parameterized by page size,
// selected columns and an optional AbortSignal (export lets the user
// cancel mid-fetch).
export async function queryComponentsPage<T>(params: {
  selectColumns: string;
  pageSize: number;
  search: string;
  filter: StockFilter;
  after: { name: string; id: string } | null;
  searchKeys?: string[];
  offset?: number; // page-number paging; when set, `after` is ignored
  signal?: AbortSignal;
}): Promise<{ rows: T[]; nextCursor: { name: string; id: string } | null }> {
  const { selectColumns, pageSize, search, filter, after, signal, searchKeys, offset } = params;

  // Cast away the generated Row type for this query: `available` isn't in
  // it yet (pending migration 0011 being applied + types regenerated), so
  // the normal typed builder would reject filtering/selecting it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("components") as any)
    .select(selectColumns)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .limit(pageSize);

  if (signal) query = query.abortSignal(signal);

  const term = search.trim();
  if (term) {
    // PostgREST's filter syntax is comma/paren-delimited, so strip
    // characters that would otherwise break out of the pattern.
    const escaped = term.replace(/[%,()"]/g, "");
    query = query.or(searchClause(escaped, searchKeys));
  }

  if (filter === "low") query = query.lte("available", LOW_STOCK_THRESHOLD);
  if (filter === "out") query = query.eq("available", 0);
  if (filter === "non_returnable") query = query.eq("returnable", false);

  if (offset !== undefined) {
    query = query.range(offset, offset + pageSize - 1);
  } else if (after) {
    // Keyset pagination on the same (name, id) order used above. Values are
    // double-quoted since PostgREST's filter syntax treats raw commas/
    // parens in a value as syntax, and component names aren't restricted.
    const quotedName = `"${after.name.replace(/"/g, '\\"')}"`;
    query = query.or(`name.gt.${quotedName},and(name.eq.${quotedName},id.gt.${after.id})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as (T & { name: string; id: string })[];
  const last = rows[rows.length - 1];
  return {
    rows,
    nextCursor: rows.length === pageSize && last ? { name: last.name, id: last.id } : null,
  };
}

export async function fetchComponentsPage(params: {
  search: string;
  filter: StockFilter;
  searchKeys?: string[];
  page: number; // 1-based
  pageSize?: number;
}): Promise<ComponentsPage> {
  const { page, pageSize = PAGE_SIZE, ...rest } = params;
  return queryComponentsPage<ComponentRow>({
    selectColumns: SELECT_COLUMNS,
    pageSize,
    after: null,
    offset: (page - 1) * pageSize,
    ...rest,
  });
}

export async function countComponents(params: {
  search: string;
  filter: StockFilter;
  searchKeys?: string[];
}): Promise<number> {
  const { search, filter, searchKeys } = params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("components") as any).select("id", { count: "exact", head: true });

  const term = search.trim();
  if (term) {
    const escaped = term.replace(/[%,()"]/g, "");
    query = query.or(searchClause(escaped, searchKeys));
  }
  if (filter === "low") query = query.lte("available", LOW_STOCK_THRESHOLD);
  if (filter === "out") query = query.eq("available", 0);
  if (filter === "non_returnable") query = query.eq("returnable", false);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export interface ComponentsMeta {
  total: number;
  lastUpdated: string | null;
}

export async function fetchComponentsMeta(): Promise<ComponentsMeta> {
  const [{ count, error: countError }, { data: latest, error: latestError }] = await Promise.all([
    supabase.from("components").select("id", { count: "exact", head: true }),
    supabase
      .from("components")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (countError) throw countError;
  if (latestError) throw latestError;
  return { total: count ?? 0, lastUpdated: latest?.updated_at ?? null };
}

// ============================================================
// Upload RPCs (chunked by the caller)
// ============================================================
export interface UploadRowInput {
  name: string;
  location: string | null;
  count: number;
  description: string | null;
  returnable: boolean | null;
  // custom field values, keyed by field key
  [field: string]: string | number | boolean | null;
}

export interface PreviewRpcRow {
  row_name: string;
  row_location: string | null;
  diff: "new" | "changed" | "unchanged" | "invalid";
  component_id: string | null;
  old_count: number | null;
  new_count: number | null;
  old_description: string | null;
  new_description: string | null;
  old_returnable: boolean | null;
  new_returnable: boolean | null;
  error: string | null;
}

export async function previewInventoryChunk(rows: UploadRowInput[]): Promise<PreviewRpcRow[]> {
  // The generator types p_rows as the generic Json union, but rows (plain
  // objects of strings/numbers/booleans) are already Json-compatible.
  const args = { p_rows: rows } as unknown as Database["public"]["Functions"]["preview_inventory_upload"]["Args"];
  const { data, error } = await supabase.rpc("preview_inventory_upload", args);
  if (error) throw error;
  return (data ?? []) as PreviewRpcRow[];
}

export interface CommitRpcResult {
  inserted: number;
  updated: number;
  unchanged: number;
  invalid: number;
}

export async function commitInventoryChunk(
  rows: UploadRowInput[],
  reason: string,
): Promise<CommitRpcResult> {
  const args = {
    p_rows: rows,
    p_reason: reason,
  } as unknown as Database["public"]["Functions"]["commit_inventory_upload"]["Args"];
  const { data, error } = await supabase.rpc("commit_inventory_upload", args);
  if (error) throw error;
  return data as unknown as CommitRpcResult;
}

export async function adjustComponent(
  componentId: string,
  newCount: number,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("adjust_component", {
    p_component_id: componentId,
    p_new_count: newCount,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function deleteComponent(componentId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("delete_component", {
    p_component_id: componentId,
    p_reason: reason || null,
  });
  if (error) throw error;
}

export interface ComponentEditFields {
  name?: string;
  location?: string;
  description?: string;
  image_url?: string;
  returnable?: boolean;
  // custom field keys
  [customField: string]: string | boolean | undefined;
}

// Only changed fields are sent; count is deliberately not editable here.
export async function updateComponent(
  componentId: string,
  fields: ComponentEditFields,
  reason?: string,
): Promise<void> {
  const args = {
    p_component_id: componentId,
    p_fields: fields,
    p_reason: reason || null,
  } as unknown as Database["public"]["Functions"]["update_component"]["Args"];
  const { error } = await supabase.rpc("update_component", args);
  if (error) throw error;
}

// ============================================================
// Adjustment history
// ============================================================
type EditChanges = Record<string, { old: unknown; new: unknown }>;

export interface AdjustmentHistoryEntry {
  kind: "adjustment" | "edit";
  changes: EditChanges | null;
  id: number;
  old_count: number | null;
  new_count: number | null;
  reason: string | null;
  source: string | null;
  actor_id: string | null;
  actor_display_name: string | null;
  created_at: string;
}

interface RawAdjustmentRow {
  kind: "adjustment" | "edit";
  changes: EditChanges | null;
  id: number;
  old_count: number | null;
  new_count: number | null;
  reason: string | null;
  source: string | null;
  actor_id: string | null;
  created_at: string;
}

export async function fetchAdjustmentHistory(componentId: string): Promise<AdjustmentHistoryEntry[]> {
  const [adjustments, edits] = await Promise.all([
    supabase
      .from("inventory_adjustments")
      .select("id, old_count, new_count, reason, source, actor_id, created_at")
      .eq("component_id", componentId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("component_edits")
      .select("id, changes, reason, actor_id, created_at")
      .eq("component_id", componentId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (adjustments.error) throw adjustments.error;
  if (edits.error) throw edits.error;

  const rows: RawAdjustmentRow[] = [
    ...((adjustments.data ?? []) as Omit<RawAdjustmentRow, "kind" | "changes">[]).map((r) => ({
      ...r,
      kind: "adjustment" as const,
      changes: null,
    })),
    ...((edits.data ?? []) as unknown as {
      id: number;
      changes: EditChanges;
      reason: string | null;
      actor_id: string | null;
      created_at: string;
    }[]).map((r) => ({
      ...r,
      kind: "edit" as const,
      old_count: null,
      new_count: null,
      source: "update_component",
    })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50);
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id))];

  let namesByActor = new Map<string, string>();
  if (actorIds.length > 0) {
    // Staff can read their own + (if admin) everyone's row per RLS — a
    // non-admin inventory_manager viewing history may still see actor_id
    // without a name if RLS blocks that other staff row, which is fine:
    // falls back to the shortened id below.
    const { data: staffRows } = await supabase
      .from("staff")
      .select("user_id, display_name")
      .in("user_id", actorIds);
    namesByActor = new Map(
      (staffRows ?? [])
        .filter((s) => s.display_name)
        .map((s) => [s.user_id, s.display_name as string]),
    );
  }

  return rows.map((row) => ({
    ...row,
    actor_display_name: row.actor_id ? namesByActor.get(row.actor_id) ?? null : null,
  }));
}

// ============================================================
// Admin-defined fields
// ============================================================
export interface ComponentField {
  key: string;
  label: string;
  type: "text" | "int" | "numeric" | "bool";
  max_length: number | null;
  sort: number;
  show_in_table: boolean;
  searchable: boolean;
  archived: boolean;
  is_core: boolean;
}

export async function fetchComponentFields(): Promise<ComponentField[]> {
  const { data, error } = await supabase
    .from("component_fields")
    .select("key, label, type, max_length, sort, show_in_table, searchable, archived, is_core")
    .order("sort", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ComponentField[];
}

export async function createComponentField(params: {
  label: string;
  type: ComponentField["type"];
  maxLength?: number | null;
  searchable?: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_component_field", {
    p_label: params.label,
    p_type: params.type,
    p_max_length: params.maxLength ?? null,
    p_searchable: params.searchable ?? false,
  });
  if (error) throw error;
  return data;
}

export async function updateComponentField(
  key: string,
  patch: { label?: string; showInTable?: boolean; searchable?: boolean; archived?: boolean },
): Promise<void> {
  const { error } = await supabase.rpc("update_component_field", {
    p_key: key,
    p_label: patch.label ?? null,
    p_show_in_table: patch.showInTable ?? null,
    p_searchable: patch.searchable ?? null,
    p_archived: patch.archived ?? null,
  });
  if (error) throw error;
}
