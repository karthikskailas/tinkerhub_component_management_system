import { useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../components/ui/Toast";
import { ProgressBar } from "../inventory/upload/UploadPrimitives";
import type { OrderColumn, RequestStatus } from "../requests/api";
import { downloadHistoryExportCsv, fetchHistoryExportRows } from "./export";

interface HistoryExportButtonProps {
  statuses: RequestStatus[];
  search: string;
  orderColumn: OrderColumn;
  dateFrom: string | null;
  dateTo: string | null;
}

export function HistoryExportButton({
  statuses,
  search,
  orderColumn,
  dateFrom,
  dateTo,
}: HistoryExportButtonProps) {
  const [progress, setProgress] = useState<{ fetched: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function runExport() {
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ fetched: 0, total: 0 });

    try {
      const rows = await fetchHistoryExportRows({
        statuses,
        search,
        orderColumn,
        dateFrom,
        dateTo,
        signal: controller.signal,
        onProgress: (fetched, total) => setProgress({ fetched, total }),
      });

      if (rows.length === 0) {
        toast.info("Nothing to export.");
      } else {
        downloadHistoryExportCsv(rows);
      }
    } catch {
      if (!controller.signal.aborted) toast.error("Export failed. Please try again.");
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }

  const exporting = !!progress;

  return (
    <div className="relative">
      <Button variant="secondary" disabled={exporting} onClick={() => void runExport()}>
        {exporting ? "Exporting..." : "Download CSV"}
      </Button>

      {progress && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs text-slate-600">
            {progress.fetched} of {progress.total || "?"} rows
          </p>
          <ProgressBar progress={{ done: progress.fetched, total: progress.total || 1 }} />
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="mt-2 min-h-11 w-full rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
