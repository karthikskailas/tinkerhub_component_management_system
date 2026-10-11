import type { PreviewRpcRow, UploadRowInput } from "../api";
import type { ParsedRow } from "./parse";

export type UploadDiff = "new" | "changed" | "unchanged" | "invalid";

export interface UploadPreviewRow {
  rowNumber: number;
  name: string;
  location: string | null;
  diff: UploadDiff;
  oldCount: number | null;
  newCount: number | null;
  reason: string | null;
  payload: UploadRowInput | null; // present only for rows sendable to commit
}

export function matchKey(name: string, location: string | null): string {
  return `${name.trim().toLowerCase()}|${(location ?? "").trim().toLowerCase()}`;
}

export function toPayload(row: ParsedRow): UploadRowInput {
  return {
    name: row.name,
    location: row.location,
    count: row.count ?? 0,
    description: row.description,
    returnable: row.returnable,
  };
}

// Correlates preview_inventory_upload's results (keyed by the exact
// trimmed name/location it echoes back) with the original ParsedRow list,
// recovering each result's spreadsheet row number and a sendable payload
// for "new"/"changed" rows. Shared by the sheet-upload flow (chunked) and
// the single-call "Add components" grid (Phase 4.1) so there's one merge.
export function mergePreviewResults(
  validRows: ParsedRow[],
  results: PreviewRpcRow[],
): UploadPreviewRow[] {
  const byRowKey = new Map(validRows.map((row) => [matchKey(row.name, row.location), row]));

  return results.map((result) => {
    const key = matchKey(result.row_name, result.row_location);
    const original = byRowKey.get(key);
    return {
      rowNumber: original?.rowNumber ?? 0,
      name: result.row_name,
      location: result.row_location,
      diff: result.diff,
      oldCount: result.old_count,
      newCount: result.new_count,
      reason: result.error,
      payload:
        result.diff === "new" || result.diff === "changed"
          ? original
            ? toPayload(original)
            : null
          : null,
    };
  });
}
