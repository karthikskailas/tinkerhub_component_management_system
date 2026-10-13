import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../components/ui/Toast";
import { downloadExportCsv, fetchExportRows } from "./export";
import type { ExportScope } from "./export";
import type { StockFilter } from "./api";
import { ProgressBar } from "./upload/UploadPrimitives";

interface ExportMenuProps {
  search: string;
  filter: StockFilter;
}

export function ExportMenu({ search, filter }: ExportMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [progress, setProgress] = useState<{ fetched: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [menuOpen]);

  async function runExport(scope: ExportScope) {
    setMenuOpen(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ fetched: 0, total: 0 });

    try {
      const rows = await fetchExportRows({
        scope,
        search,
        filter,
        signal: controller.signal,
        onProgress: (fetched, total) => setProgress({ fetched, total }),
      });

      if (rows.length === 0) {
        toast.info("Nothing to export.");
      } else {
        downloadExportCsv(rows);
      }
    } catch {
      if (!controller.signal.aborted) {
        toast.error("Export failed. Please try again.");
      }
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }

  const exporting = !!progress;

  return (
    <div ref={containerRef} className="relative">
      <Button variant="secondary" disabled={exporting} onClick={() => setMenuOpen((v) => !v)}>
        {exporting ? "Exporting..." : "Download CSV"}
      </Button>

      {menuOpen && !exporting && (
        <div className="absolute right-0 z-10 mt-2 flex w-64 flex-col overflow-hidden rounded-xl bg-surface shadow-overlay">
          <button
            type="button"
            onClick={() => void runExport("current")}
            className="px-4 py-2.5 text-left text-sm text-foreground hover:bg-default"
          >
            Current view (search and filter applied)
          </button>
          <button
            type="button"
            onClick={() => void runExport("all")}
            className="px-4 py-2.5 text-left text-sm text-foreground hover:bg-default"
          >
            All components
          </button>
        </div>
      )}

      {progress && (
        <div className="absolute right-0 z-10 mt-2 flex w-64 flex-col gap-2 rounded-xl bg-surface p-4 shadow-overlay">
          <p className="text-sm text-muted">
            {progress.fetched} of {progress.total || "?"} rows
          </p>
          <ProgressBar progress={{ done: progress.fetched, total: progress.total || 1 }} />
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="self-start text-sm font-medium text-danger hover:underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
