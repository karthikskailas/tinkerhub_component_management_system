import { supabase } from "../../../lib/supabase";
import type { Database } from "../../../types/database.types";

export type RequestStatus = Database["public"]["Enums"]["request_status"];

export const PAGE_SIZE = 20;

export interface RequestListRow {
  id: string;
  requester_name: string;
  phone: string;
  created_at: string;
  status: RequestStatus;
  project_id: string | null;
  project_name: string | null;
  item_count: number;
  expires_at: string | null;
}

export interface RequestListPage {
  rows: RequestListRow[];
  nextCursor: string | null;
}

// The generated types don't model PostgREST's embedded-relation/aggregate
// shapes (projects(name), request_items(count)), so the raw query result is
// typed locally and mapped into RequestListRow below.
interface RawListRow {
  id: string;
  requester_name: string;
  phone: string;
  created_at: string;
  status: RequestStatus;
  project_id: string | null;
  expires_at: string | null;
  projects: { name: string } | null;
  request_items: { count: number }[] | null;
}

const LIST_SELECT =
  "id, requester_name, phone, created_at, status, project_id, expires_at, projects(name), request_items(count)";

function mapListRow(row: RawListRow): RequestListRow {
  return {
    id: row.id,
    requester_name: row.requester_name,
    phone: row.phone,
    created_at: row.created_at,
    status: row.status,
    project_id: row.project_id,
    project_name: row.projects?.name ?? null,
    item_count: row.request_items?.[0]?.count ?? 0,
    expires_at: row.expires_at,
  };
}

async function fetchListPage(
  status: RequestStatus,
  afterCreatedAt: string | null,
): Promise<RequestListPage> {
  let query = supabase
    .from("requests")
    .select(LIST_SELECT)
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(PAGE_SIZE);

  if (afterCreatedAt) query = query.gt("created_at", afterCreatedAt);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data as unknown as RawListRow[]).map(mapListRow);
  return {
    rows,
    nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null,
  };
}

export const fetchPendingPage = (afterCreatedAt: string | null) =>
  fetchListPage("pending", afterCreatedAt);

// The header count is the true total (not just rows loaded so far), so it's
// a dedicated exact count rather than list.length.
export async function fetchPendingCount(): Promise<number> {
  const { count, error } = await supabase
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export const fetchApprovedPage = (afterCreatedAt: string | null) =>
  fetchListPage("approved", afterCreatedAt);

// A single row, re-shaped like a list page row, for splicing a realtime
// INSERT straight into the cache without a full list refetch.
export async function fetchListRowById(id: string): Promise<RequestListRow | null> {
  const { data, error } = await supabase
    .from("requests")
    .select(LIST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapListRow(data as unknown as RawListRow) : null;
}

// ============================================================
// Detail view
// ============================================================
export interface RequestDetailItem {
  component_id: string;
  name: string;
  description: string | null;
  location: string | null;
  qty: number;
  approved_qty: number | null;
  count: number;
  reserved: number;
}

export interface RequestDetail {
  id: string;
  requester_name: string;
  phone: string;
  created_at: string;
  status: RequestStatus;
  screenshot_path: string | null;
  reject_reason: string | null;
  expires_at: string | null;
  project_name: string | null;
  project_description: string | null;
  project_owner_name: string | null;
  items: RequestDetailItem[];
}

interface RawDetailRow {
  id: string;
  requester_name: string;
  phone: string;
  created_at: string;
  status: RequestStatus;
  screenshot_path: string | null;
  reject_reason: string | null;
  expires_at: string | null;
  projects: { name: string; description: string | null; owner_name: string | null } | null;
  request_items: {
    component_id: string;
    qty: number;
    approved_qty: number | null;
    components: {
      name: string;
      description: string | null;
      location: string | null;
      count: number;
      reserved: number;
    } | null;
  }[];
}

export async function fetchRequestDetail(id: string): Promise<RequestDetail> {
  const { data, error } = await supabase
    .from("requests")
    .select(
      `id, requester_name, phone, created_at, status, screenshot_path, reject_reason, expires_at,
       projects(name, description, owner_name),
       request_items(component_id, qty, approved_qty, components!request_items_component_id_fkey(name, description, location, count, reserved))`,
    )
    .eq("id", id)
    .single();

  if (error) throw error;

  const row = data as unknown as RawDetailRow;

  return {
    id: row.id,
    requester_name: row.requester_name,
    phone: row.phone,
    created_at: row.created_at,
    status: row.status,
    screenshot_path: row.screenshot_path,
    reject_reason: row.reject_reason,
    expires_at: row.expires_at,
    project_name: row.projects?.name ?? null,
    project_description: row.projects?.description ?? null,
    project_owner_name: row.projects?.owner_name ?? null,
    items: row.request_items.map((item) => ({
      component_id: item.component_id,
      name: item.components?.name ?? "Unknown component",
      description: item.components?.description ?? null,
      location: item.components?.location ?? null,
      qty: item.qty,
      approved_qty: item.approved_qty,
      count: item.components?.count ?? 0,
      reserved: item.components?.reserved ?? 0,
    })),
  };
}

// ============================================================
// Actions
// ============================================================
export interface PickupCardItem {
  name: string;
  location: string | null;
  approved_qty: number;
}

export interface PickupCardData {
  request_id: string;
  short_code: string;
  requester_name: string;
  phone: string;
  project_name: string | null;
  items: PickupCardItem[];
  expires_at: string | null;
  public_token: string;
}

// approve_request's own JSON response doesn't include expires_at even
// though the same call sets it, so it's fetched separately rather than
// assumed client-side (e.g. hardcoding "+7 days") to stay correct if the
// backend's expiry window ever changes. See the backend-mismatch note in
// the final report for this phase.
export async function fetchApprovalExtras(
  requestId: string,
): Promise<{ expires_at: string | null; public_token: string }> {
  const { data, error } = await supabase
    .from("requests")
    .select("expires_at, public_token")
    .eq("id", requestId)
    .single();
  if (error) throw error;
  return data;
}

export async function approveRequest(
  requestId: string,
  items: { component_id: string; approved_qty: number }[],
): Promise<PickupCardData> {
  const { data, error } = await supabase.rpc("approve_request", {
    p_request_id: requestId,
    p_items: items,
  });
  if (error) throw error;
  const card = data as unknown as Omit<PickupCardData, "expires_at" | "public_token">;
  const extras = await fetchApprovalExtras(requestId);
  return { ...card, ...extras };
}

export async function rejectRequest(requestId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("reject_request", {
    p_request_id: requestId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function adminCancelRequest(requestId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("admin_cancel_request", {
    p_request_id: requestId,
    p_reason: reason,
  });
  if (error) throw error;
}

// ============================================================
// Pickup card data for an already-approved request (reopened from the
// Approved tab, rather than fresh off the approve_request response).
// ============================================================
export async function fetchPickupCardData(requestId: string): Promise<PickupCardData> {
  const [detail, extras] = await Promise.all([
    fetchRequestDetail(requestId),
    fetchApprovalExtras(requestId),
  ]);
  return {
    request_id: detail.id,
    short_code: detail.id.slice(0, 8).toUpperCase(),
    requester_name: detail.requester_name,
    phone: detail.phone,
    project_name: detail.project_name,
    expires_at: detail.expires_at,
    public_token: extras.public_token,
    items: detail.items
      .filter((item) => (item.approved_qty ?? 0) > 0)
      .map((item) => ({
        name: item.name,
        location: item.location,
        approved_qty: item.approved_qty ?? 0,
      })),
  };
}

export async function createScreenshotSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("screenshots").createSignedUrl(path, 120);
  if (error) return null;
  return data?.signedUrl ?? null;
}
