import { buildCsv, csvCell, downloadCsv } from "../../../lib/csv";
import { countComponents, queryComponentsPage } from "./api";
import type { ComponentField, StockFilter } from "./api";

const EXPORT_PAGE_SIZE = 1000;
const EXPORT_SELECT_COLUMNS = "*";

export interface ExportRow {
  name: string;
  location: string | null;
  count: number;
  description: string | null;
  returnable: boolean;
  reserved: number;
  available: number;
  updated_at: string;
  [customField: string]: unknown;
}

export type ExportScope = "current" | "all";

export async function countExportRows(params: {
  scope: ExportScope;
  search: string;
  filter: StockFilter;
  searchKeys?: string[];
}): Promise<number> {
  if (params.scope === "all") return countComponents({ search: "", filter: "all" });
  return countComponents({
    search: params.search,
    filter: params.filter,
    searchKeys: params.searchKeys,
  });
}

// Pages through the full result set in chunks of 1000, never holding more
// than one page's worth of an in-flight request at a time, and lets the
// caller cancel mid-fetch (and track progress against the known total).
export async function fetchExportRows(params: {
  scope: ExportScope;
  search: string;
  filter: StockFilter;
  searchKeys?: string[];
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
        searchKeys: params.searchKeys,
        signal: params.signal,
      });
    rows.push(...page.rows);
    params.onProgress(rows.length, total);
    if (!page.nextCursor) break;
    after = page.nextCursor;
  }

  return rows;
}

function customCell(value: unknown, field: ComponentField): string {
  if (value === null || value === undefined) return "";
  if (field.type === "bool") return value ? "yes" : "no";
  return String(value);
}

// Core columns first (same order as the upload template), then custom
// fields by their label, so an exported file re-uploads as all Unchanged.
export function buildExportCsv(rows: ExportRow[], fields: ComponentField[] = []): string {
  const header = [
    "name,count,location,description,returnable",
    ...fields.map((f) => csvCell(f.label)),
    "reserved,available,updated_at",
  ].join(",");
  const lines = rows.map((row) => [
    csvCell(row.name),
    csvCell(String(row.count), true),
    csvCell(row.location ?? ""),
    csvCell(row.description ?? ""),
    csvCell(row.returnable ? "yes" : "no"),
    ...fields.map((f) => csvCell(customCell(row[f.key], f))),
    csvCell(String(row.reserved), true),
    csvCell(String(row.available), true),
    csvCell(row.updated_at),
  ]);
  return buildCsv(header, lines);
}

export function downloadExportCsv(rows: ExportRow[], fields: ComponentField[] = []): void {
  downloadCsv("inventory", buildExportCsv(rows, fields));
}
