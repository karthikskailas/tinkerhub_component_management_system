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

const FORMULA_PREFIX = /^[=+\-@]/;

function csvCell(value: string, isNumeric: boolean): string {
  // Spreadsheet formula injection guard: a cell starting with =, +, - or @
  // gets interpreted as a formula by Excel/Sheets unless neutralized.
  // Numeric columns never need this (a bare number can't start with one of
  // those and still parse as the number it is).
  const safe = !isNumeric && FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildExportCsv(rows: ExportRow[]): string {
  const header = "name,location,count,description,returnable,reserved,available,updated_at";
  const lines = rows.map((row) =>
    [
      csvCell(row.name, false),
      csvCell(row.location ?? "", false),
      csvCell(String(row.count), true),
      csvCell(row.description ?? "", false),
      csvCell(row.returnable ? "yes" : "no", false),
      csvCell(String(row.reserved), true),
      csvCell(String(row.available), true),
      csvCell(row.updated_at, false),
    ].join(","),
  );
  // UTF-8 BOM so Excel detects the encoding and renders non-ASCII correctly.
  return "﻿" + [header, ...lines].join("\n");
}

function exportFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `inventory-${stamp}.csv`;
}

export function downloadExportCsv(rows: ExportRow[]): void {
  const csv = buildExportCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFilename();
  link.click();
  URL.revokeObjectURL(url);
}
