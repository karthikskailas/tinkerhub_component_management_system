import { supabase } from "../../../lib/supabase";
import type { Database } from "../../../types/database.types";

export type RequestStatus = Database["public"]["Enums"]["request_status"];
export type ItemCondition = Database["public"]["Enums"]["item_condition"];

// ============================================================
// List (shared shape across Issue / Returns / History)
// ============================================================
export interface RequestListRow {
  id: string;
  code: string;
  requester_name: string;
  phone: string;
  project_name: string | null;
  item_count: number;
  status: RequestStatus;
  created_at: string;
  approved_at: string | null;
  issued_at: string | null;
  returned_at: string | null;
  expires_at: string | null;
  updated_at: string;
}

export type OrderColumn = "approved_at" | "issued_at" | "updated_at";

// Just the timestamp, no id tie-breaker: a hand-built OR-with-tiebreak
// filter would need to interpolate raw timestamp strings (which contain
// `+`/`:`) into a query string, which is fragile. Two requests sharing the
// exact same microsecond-precision timestamp is unlikely enough for an
// admin tool that the tiny edge case (one skipped/duplicated row right at
// a page boundary) is an acceptable trade — the same simplification the
// review tab's list pagination already makes for its created_at cursor.
export type ListCursor = string;

export interface ListPage {
  rows: RequestListRow[];
  nextCursor: ListCursor | null;
}

// `request_code` depends on migration 0012 (a generated column mirroring
// the short code already shown throughout the UI, upper(left(id::text,8)))
// — see that file for why: `id` is a uuid column, and PostgREST can't
// `ilike` it without a text cast it has no way to add. Until 0012 is
// applied, code search (not name/phone search) will 400.
const LIST_SELECT =
  "id, request_code, requester_name, phone, status, created_at, approved_at, issued_at, returned_at, expires_at, updated_at, projects(name), request_items(count)";

interface RawListRow {
  id: string;
  request_code: string;
  requester_name: string;
  phone: string;
  status: RequestStatus;
  created_at: string;
  approved_at: string | null;
  issued_at: string | null;
  returned_at: string | null;
  expires_at: string | null;
  updated_at: string;
  projects: { name: string } | null;
  request_items: { count: number }[] | null;
}

function mapListRow(row: RawListRow): RequestListRow {
  return {
    id: row.id,
    code: row.request_code,
    requester_name: row.requester_name,
    phone: row.phone,
    project_name: row.projects?.name ?? null,
    item_count: row.request_items?.[0]?.count ?? 0,
    status: row.status,
    created_at: row.created_at,
    approved_at: row.approved_at,
    issued_at: row.issued_at,
    returned_at: row.returned_at,
    expires_at: row.expires_at,
    updated_at: row.updated_at,
  };
}

export async function matchingProjectIds(term: string): Promise<string[]> {
  if (!term) return [];
  const escaped = term.replace(/[%,()"]/g, "");
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .ilike("name", `%${escaped}%`)
    .limit(100);
  if (error) return [];
  return (data ?? []).map((p) => p.id);
}

export interface FetchListParams {
  statuses: RequestStatus[];
  search: string;
  /** Also match the search term against project name (History only) —
   *  needs a separate lookup since PostgREST's `.or()` can't filter on an
   *  embedded relation's column in the same expression as the base table's. */
  searchProjects?: boolean;
  orderColumn: OrderColumn;
  ascending: boolean;
  pageSize: number;
  after: ListCursor | null;
  /** Inclusive date-range filter on orderColumn (History only), ISO strings. */
  dateFrom?: string | null;
  dateTo?: string | null;
  signal?: AbortSignal;
}

export async function fetchRequestListPage(params: FetchListParams): Promise<ListPage> {
  const {
    statuses,
    search,
    searchProjects,
    orderColumn,
    ascending,
    pageSize,
    after,
    dateFrom,
    dateTo,
    signal,
  } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("requests") as any)
    .select(LIST_SELECT)
    .in("status", statuses)
    .order(orderColumn, { ascending })
    .order("id", { ascending })
    .limit(pageSize);

  if (signal) query = query.abortSignal(signal);

  const term = search.trim();
  if (term) {
    const escaped = term.replace(/[%,()"]/g, "");
    const clauses = [
      `request_code.ilike.%${escaped}%`,
      `requester_name.ilike.%${escaped}%`,
      `phone.ilike.%${escaped}%`,
    ];
    if (searchProjects) {
      const projectIds = await matchingProjectIds(term);
      if (projectIds.length > 0) {
        clauses.push(`project_id.in.(${projectIds.join(",")})`);
      }
    }
    query = query.or(clauses.join(","));
  }

  if (dateFrom) query = query.gte(orderColumn, dateFrom);
  if (dateTo) query = query.lte(orderColumn, dateTo);

  if (after) {
    query = ascending ? query.gt(orderColumn, after) : query.lt(orderColumn, after);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data as unknown as RawListRow[]).map(mapListRow);
  const last = rows[rows.length - 1];
  const lastValue = last ? last[orderColumn] : null;
  return {
    rows,
    nextCursor: rows.length === pageSize && lastValue ? lastValue : null,
  };
}

export async function fetchRequestCount(statuses: RequestStatus[]): Promise<number> {
  const { count, error } = await supabase
    .from("requests")
    .select("id", { count: "exact", head: true })
    .in("status", statuses);
  if (error) throw error;
  return count ?? 0;
}

// Same filters as fetchRequestListPage (status + search + date range), for
// an accurate "N of M" export progress total — fetchRequestCount only
// filters by status, which would under/over-state the real row count once
// search or a date range is applied.
export async function countFilteredRequests(params: {
  statuses: RequestStatus[];
  search: string;
  searchProjects?: boolean;
  dateFrom?: string | null;
  dateTo?: string | null;
  orderColumn: OrderColumn;
}): Promise<number> {
  const { statuses, search, searchProjects, dateFrom, dateTo, orderColumn } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("requests") as any)
    .select("id", { count: "exact", head: true })
    .in("status", statuses);

  const term = search.trim();
  if (term) {
    const escaped = term.replace(/[%,()"]/g, "");
    const clauses = [
      `request_code.ilike.%${escaped}%`,
      `requester_name.ilike.%${escaped}%`,
      `phone.ilike.%${escaped}%`,
    ];
    if (searchProjects) {
      const projectIds = await matchingProjectIds(term);
      if (projectIds.length > 0) clauses.push(`project_id.in.(${projectIds.join(",")})`);
    }
    query = query.or(clauses.join(","));
  }

  if (dateFrom) query = query.gte(orderColumn, dateFrom);
  if (dateTo) query = query.lte(orderColumn, dateTo);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

// ============================================================
// Detail (superset of fields: covers Issue / Returns / History)
// ============================================================
export interface RequestDetailItem {
  component_id: string;
  name: string;
  location: string | null;
  returnable: boolean;
  qty: number;
  approved_qty: number | null;
  issued_qty: number | null;
  returned_qty: number | null;
  condition: ItemCondition | null;
  note: string | null;
  count: number;
  reserved: number;
}

export interface RequestDetail {
  id: string;
  code: string;
  requester_name: string;
  phone: string;
  status: RequestStatus;
  created_at: string;
  approved_at: string | null;
  issued_at: string | null;
  returned_at: string | null;
  expires_at: string | null;
  reject_reason: string | null;
  project_name: string | null;
  items: RequestDetailItem[];
}

interface RawDetailRow {
  id: string;
  request_code: string;
  requester_name: string;
  phone: string;
  status: RequestStatus;
  created_at: string;
  approved_at: string | null;
  issued_at: string | null;
  returned_at: string | null;
  expires_at: string | null;
  reject_reason: string | null;
  projects: { name: string } | null;
  request_items: {
    component_id: string;
    qty: number;
    approved_qty: number | null;
    issued_qty: number | null;
    returned_qty: number | null;
    condition: ItemCondition | null;
    note: string | null;
    components: { name: string; location: string | null; returnable: boolean; count: number; reserved: number } | null;
  }[];
}

export async function fetchRequestDetail(id: string): Promise<RequestDetail> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("requests") as any)
    .select(
      `id, request_code, requester_name, phone, status, created_at, approved_at, issued_at, returned_at, expires_at, reject_reason,
       projects(name),
       request_items(component_id, qty, approved_qty, issued_qty, returned_qty, condition, note, components!request_items_component_id_fkey(name, location, returnable, count, reserved))`,
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  const row = data as RawDetailRow;

  return {
    id: row.id,
    code: row.request_code,
    requester_name: row.requester_name,
    phone: row.phone,
    status: row.status,
    created_at: row.created_at,
    approved_at: row.approved_at,
    issued_at: row.issued_at,
    returned_at: row.returned_at,
    expires_at: row.expires_at,
    reject_reason: row.reject_reason,
    project_name: row.projects?.name ?? null,
    items: row.request_items.map((item) => ({
      component_id: item.component_id,
      name: item.components?.name ?? "Unknown component",
      location: item.components?.location ?? null,
      returnable: item.components?.returnable ?? true,
      qty: item.qty,
      approved_qty: item.approved_qty,
      issued_qty: item.issued_qty,
      returned_qty: item.returned_qty,
      condition: item.condition,
      note: item.note,
      count: item.components?.count ?? 0,
      reserved: item.components?.reserved ?? 0,
    })),
  };
}

// ============================================================
// Event timeline (History only, loaded on open)
// ============================================================
export interface RequestEvent {
  id: number;
  from_status: RequestStatus | null;
  to_status: RequestStatus | null;
  note: string | null;
  actor_id: string | null;
  actor_display_name: string | null;
  created_at: string;
}

export async function fetchRequestEvents(requestId: string): Promise<RequestEvent[]> {
  const { data, error } = await supabase
    .from("request_events")
    .select("id, from_status, to_status, note, actor_id, created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id))];

  let namesByActor = new Map<string, string>();
  if (actorIds.length > 0) {
    // Same caveat as inventory_adjustments' history: a non-admin staff
    // member may not be able to read another staff row under RLS, in which
    // case it just falls back to the shortened id in the UI.
    const { data: staffRows } = await supabase
      .from("staff")
      .select("user_id, display_name")
      .in("user_id", actorIds);
    namesByActor = new Map(
      (staffRows ?? []).filter((s) => s.display_name).map((s) => [s.user_id, s.display_name as string]),
    );
  }

  return rows.map((row) => ({
    ...row,
    actor_display_name: row.actor_id ? namesByActor.get(row.actor_id) ?? null : null,
  }));
}

// ============================================================
// Actions
// ============================================================
export async function issueRequest(
  requestId: string,
  items: { component_id: string; issued_qty: number }[],
): Promise<void> {
  const args = {
    p_request_id: requestId,
    p_items: items,
  } as unknown as Database["public"]["Functions"]["issue_request"]["Args"];
  const { error } = await supabase.rpc("issue_request", args);
  if (error) throw error;
}

export async function verifyReturn(
  requestId: string,
  items: { component_id: string; returned_qty: number; condition: ItemCondition; note: string | null }[],
): Promise<void> {
  const args = {
    p_request_id: requestId,
    p_items: items,
  } as unknown as Database["public"]["Functions"]["verify_return"]["Args"];
  const { error } = await supabase.rpc("verify_return", args);
  if (error) throw error;
}
