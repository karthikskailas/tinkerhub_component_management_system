import { supabase } from "../../lib/supabase";
import type { Database } from "../../types/database.types";

export type RequestStatus = Database["public"]["Enums"]["request_status"];

export interface RequestItemView {
  name: string;
  qty: number;
  approved_qty: number | null;
}

export interface RequestByTokenResult {
  status: RequestStatus;
  public_token: string;
  code: string;
  requester_name: string;
  expires_at: string | null;
  project_name: string | null;
  reject_reason: string | null;
  items: RequestItemView[] | null;
  return_pending?: boolean;
  return_submission?: ReturnSubmission | null;
}

export interface ReturnSubmission {
  submitted_at: string;
  receiver: string;
  photo_path: string | null;
}

export interface ReturnInput {
  photoPath: string;
  staffId: string | null;
  otherName: string;
  otherDesignation: string;
  note: string;
}

export interface ResubmitResult {
  project_id: string | null;
  project_name: string | null;
  requester_name: string;
  phone: string;
  items: { component_id: string; qty: number }[] | null;
}

export async function findProjects(phone: string) {
  const { data, error } = await supabase.rpc("find_projects", { p_phone: phone });
  if (error) throw error;
  return data ?? [];
}

export interface SubmitRequestInput {
  projectId: string | null;
  newProject: { name: string; description: string; owner_name: string } | null;
  requesterName: string;
  phone: string;
  screenshotPath: string;
  items: { component_id: string; qty: number }[];
}

export async function submitRequest(input: SubmitRequestInput) {
  // The generator doesn't mark nullable RPC args as nullable, but
  // p_project_id/p_new_project are genuinely one-or-the-other in the SQL
  // function, so a null here is intentional and valid at runtime.
  const args = {
    p_project_id: input.projectId,
    p_new_project: input.newProject,
    p_requester_name: input.requesterName,
    p_phone: input.phone,
    p_screenshot_path: input.screenshotPath,
    p_items: input.items,
  } as Database["public"]["Functions"]["submit_request"]["Args"];

  const { data, error } = await supabase.rpc("submit_request", args);
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("submit_request returned no row");
  return row;
}

export async function cancelRequest(requestId: string) {
  const { error } = await supabase.rpc("cancel_request", { p_request_id: requestId });
  if (error) throw error;
}

export async function getRequestByToken(token: string) {
  const { data, error } = await supabase.rpc("get_request_by_token", { p_token: token });
  if (error) throw error;
  return data as unknown as RequestByTokenResult;
}

export async function resubmitRequest(oldRequestId: string) {
  const { data, error } = await supabase.rpc("resubmit_request", {
    p_old_request_id: oldRequestId,
  });
  if (error) throw error;
  return data as unknown as ResubmitResult;
}

export async function uploadScreenshot(path: string, file: File) {
  const { error } = await supabase.storage.from("screenshots").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function listHandoverStaff() {
  const { data, error } = await supabase.rpc("list_handover_staff_public");
  if (error) throw error;
  return data ?? [];
}

// Named args always: p_photo_path sits before the defaulted ones in SQL.
export async function submitReturn(requestId: string, token: string | null, input: ReturnInput) {
  const common = {
    p_photo_path: input.photoPath,
    p_receiver_staff_id: input.staffId ?? undefined,
    p_receiver_name: input.staffId ? undefined : input.otherName.trim(),
    p_receiver_designation: input.staffId ? undefined : input.otherDesignation.trim(),
    p_note: input.note.trim() || undefined,
  };
  const { error } = token
    ? await supabase.rpc("submit_return_by_token", { p_token: token, ...common })
    : await supabase.rpc("submit_return", { p_request_id: requestId, ...common });
  if (error) throw error;
}
