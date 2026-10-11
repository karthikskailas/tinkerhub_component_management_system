import { buildCsv, csvCell, downloadCsv } from "../../../lib/csv";
import { countComponents, queryComponentsPage } from "./api";
import type { StockFilter } from "./api";

const EXPORT_PAGE_SIZE = 1000;
const EXPORT_SELECT_COLUMNS =
  "id, name, location, count, description, returnable, reserved, available, updated_at";

export interface ExportRow {
  name: string;
  location: string | null;
  count: number;
  description: string | null;
  returnable: boolean;
  reserved: number;
  available: number;
  updated_at: string;
}

export type ExportScope = "current" | "all";

export async function countExportRows(params: {
  scope: ExportScope;
  search: string;
  filter: StockFilter;
}): Promise<number> {
  if (params.scope === "all") return countComponents({ search: "", filter: "all" });
  return countComponents({ search: params.search, filter: params.filter });
}

// Pages through the full result set in chunks of 1000, never holding more
// than one page's worth of an in-flight request at a time, and lets the
// caller cancel mid-fetch (and track progress against the known total).
export async function fetchExportRows(params: {
  scope: ExportScope;
  search: string;
  filter: StockFilter;
  signal: AbortSignal;
  onProgress: (fetched: number, total: number) => void;
}): Promise<ExportRow[]> {
  const search = params.scope === "all" ? "" : params.search;
  const filter = params.scope === "all" ? "all" : params.filter;

  const total = await countExportRows(params);
  const rows: ExportRow[] = [];
  let after: { name: string; id: string } | null = null;

  while (true) {
    const page: { rows: (ExportRow & { id: string })[]; nextCursor: { name: string; id: string } | null } =
      await queryComponentsPage<ExportRow & { id: string }>({
        selectColumns: EXPORT_SELECT_COLUMNS,
        pageSize: EXPORT_PAGE_SIZE,
        search,
        filter,
        after,
        signal: params.signal,
      });
    rows.push(...page.rows);
    params.onProgress(rows.length, total);
    if (!page.nextCursor) break;
    after = page.nextCursor;
  }

  return rows;
}

export function buildExportCsv(rows: ExportRow[]): string {
  const header = "name,location,count,description,returnable,reserved,available,updated_at";
  const lines = rows.map((row) => [
    csvCell(row.name),
    csvCell(row.location ?? ""),
    csvCell(String(row.count), true),
    csvCell(row.description ?? ""),
    csvCell(row.returnable ? "yes" : "no"),
    csvCell(String(row.reserved), true),
    csvCell(String(row.available), true),
    csvCell(row.updated_at),
  ]);
  return buildCsv(header, lines);
}

export function downloadExportCsv(rows: ExportRow[]): void {
  downloadCsv("inventory", buildExportCsv(rows));
}
