import { buildCsv, csvCell, downloadCsv } from "../../../lib/csv";
import { supabase } from "../../../lib/supabase";
import { countFilteredRequests, fetchRequestListPage } from "../requests/api";
import type { OrderColumn, RequestStatus } from "../requests/api";

const EXPORT_PAGE_SIZE = 1000;
const ITEMS_LOOKUP_CHUNK = 200;

export interface HistoryExportRow {
  code: string;
  requester_name: string;
  phone: string;
  project_name: string | null;
  status: RequestStatus;
  issued_at: string | null;
  returned_at: string | null;
  handed_over_by: string | null;
  handover_confirmed_at: string | null;
  return_receiver: string | null;
  return_submitted_at: string | null;
  return_photo: boolean;
  item_count: number;
  items: string; // "Name x qty; Name x qty"
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function fetchItemsSummary(requestIds: string[]): Promise<Map<string, string>> {
  const summary = new Map<string, string[]>();

  for (const idChunk of chunk(requestIds, ITEMS_LOOKUP_CHUNK)) {
    const { data, error } = await supabase
      .from("request_items")
      .select("request_id, qty, components!request_items_component_id_fkey(name)")
      .in("request_id", idChunk);
    if (error) throw error;

    for (const row of (data ?? []) as unknown as {
      request_id: string;
      qty: number;
      components: { name: string } | null;
    }[]) {
      const name = row.components?.name ?? "Unknown component";
      const list = summary.get(row.request_id) ?? [];
      list.push(`${name} x${row.qty}`);
      summary.set(row.request_id, list);
    }
  }

  return new Map([...summary].map(([id, parts]) => [id, parts.join("; ")]));
}

export async function fetchHistoryExportRows(params: {
  statuses: RequestStatus[];
  search: string;
  orderColumn: OrderColumn;
  dateFrom: string | null;
  dateTo: string | null;
  signal: AbortSignal;
  onProgress: (fetched: number, total: number) => void;
}): Promise<HistoryExportRow[]> {
  const { statuses, search, orderColumn, dateFrom, dateTo, signal, onProgress } = params;

  const total = await countFilteredRequests({
    statuses,
    search,
    searchProjects: true,
    dateFrom,
    dateTo,
    orderColumn,
  });

  const rows: HistoryExportRow[] = [];
  let after: string | null = null;

  while (true) {
    const page = await fetchRequestListPage({
      statuses,
      search,
      searchProjects: true,
      orderColumn,
      ascending: false,
      pageSize: EXPORT_PAGE_SIZE,
      after,
      dateFrom,
      dateTo,
      signal,
    });

    const itemsByRequest = await fetchItemsSummary(page.rows.map((r) => r.id));

    for (const row of page.rows) {
      rows.push({
        code: row.code,
        requester_name: row.requester_name,
        phone: row.phone,
        project_name: row.project_name,
        status: row.status,
        issued_at: row.issued_at,
        returned_at: row.returned_at,
        handed_over_by: row.handed_over_by,
        handover_confirmed_at: row.handover_confirmed_at,
        return_receiver: row.return_receiver,
        return_submitted_at: row.return_submitted_at,
        return_photo: row.return_photo,
        item_count: row.item_count,
        items: itemsByRequest.get(row.id) ?? "",
      });
    }

    onProgress(rows.length, total);
    if (!page.nextCursor) break;
    after = page.nextCursor;
  }

  return rows;
}

export function buildHistoryExportCsv(rows: HistoryExportRow[]): string {
  const header = "code,requester,phone,project,status,issued_at,returned_at,handed_over_by,handover_confirmed_at,returned_to_as_reported,return_submitted_at,return_photo,item_count,items";
  const lines = rows.map((row) => [
    csvCell(row.code),
    csvCell(row.requester_name),
    csvCell(row.phone),
    csvCell(row.project_name ?? ""),
    csvCell(row.status),
    csvCell(row.issued_at ?? ""),
    csvCell(row.returned_at ?? ""),
    csvCell(row.handed_over_by ?? ""),
    csvCell(row.handover_confirmed_at ?? ""),
    csvCell(row.return_receiver ?? ""),
    csvCell(row.return_submitted_at ?? ""),
    csvCell(row.return_photo ? "yes" : "no"),
    csvCell(String(row.item_count), true),
    csvCell(row.items),
  ]);
  return buildCsv(header, lines);
}

export function downloadHistoryExportCsv(rows: HistoryExportRow[]): void {
  downloadCsv("history", buildHistoryExportCsv(rows));
}
