import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { SkeletonLines } from "../../../components/ui/Skeleton";
import { AdjustDialog } from "./AdjustDialog";
import { ComponentRow, GRID_COLS } from "./ComponentRow";
import { ExportMenu } from "./ExportMenu";
import { HistoryDrawer } from "./HistoryDrawer";
import { useComponents, useComponentsMeta, useInvalidateComponents } from "./useComponents";
import type { ComponentRow as ComponentRowData, StockFilter } from "./api";
import { AddComponentsDialog } from "./upload/AddComponentsDialog";
import { UploadDialog } from "./upload/UploadDialog";

const FILTERS: { key: StockFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "low", label: "Low stock" },
  { key: "out", label: "Out of stock" },
  { key: "non_returnable", label: "Non-returnable" },
];

export function InventoryPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [adjustTarget, setAdjustTarget] = useState<ComponentRowData | null>(null);
  const [historyTarget, setHistoryTarget] = useState<ComponentRowData | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const components = useComponents(search, filter);
  const meta = useComponentsMeta();
  const invalidate = useInvalidateComponents();

  function refreshAll() {
    invalidate();
    void meta.refetch();
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500">
            {meta.data ? `${meta.data.total} components` : "—"}
            {meta.data?.lastUpdated && (
              <> · updated {new Date(meta.data.lastUpdated).toLocaleString()}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu search={search} filter={filter} />
          <Button variant="secondary" onClick={() => setUploadOpen(true)}>
            Upload sheet
          </Button>
          <Button onClick={() => setAddOpen(true)}>Add components</Button>
        </div>
      </div>

      <input
        type="search"
        inputMode="search"
        placeholder="Search by name or location..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`min-h-11 flex-1 whitespace-nowrap rounded-md px-3 text-sm font-medium ${
              filter === f.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {components.isLoading && <SkeletonLines count={8} />}

      {components.isError && (
        <p className="text-sm text-red-600">
          Couldn't load components.{" "}
          <button type="button" className="underline" onClick={() => components.refetch()}>
            Retry
          </button>
        </p>
      )}

      {!components.isLoading && !components.isError && components.rows.length === 0 && (
        <div className="py-12 text-center">
          <p className="mb-3 text-sm text-slate-400">
            {search || filter !== "all" ? "No components match." : "No components yet."}
          </p>
          {!search && filter === "all" && (
            <Button onClick={() => setUploadOpen(true)}>Upload sheet</Button>
          )}
        </div>
      )}

      {components.rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div
            className={`hidden grid-cols-1 gap-2 border-b border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-500 sm:grid ${GRID_COLS}`}
          >
            <span>Name</span>
            <span>Location</span>
            <span className="text-right">Count</span>
            <span className="text-right">Reserved</span>
            <span className="text-right">Available</span>
            <span />
          </div>
          {components.rows.map((component) => (
            <ComponentRow
              key={component.id}
              component={component}
              onAdjust={setAdjustTarget}
              onHistory={setHistoryTarget}
            />
          ))}
        </div>
      )}

      {components.hasNextPage && (
        <div className="mt-4 text-center">
          <Button
            variant="secondary"
            loading={components.isFetchingNextPage}
            onClick={() => components.fetchNextPage()}
          >
            Load more
          </Button>
        </div>
      )}

      <AdjustDialog
        component={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onAdjusted={refreshAll}
      />
      <HistoryDrawer component={historyTarget} onClose={() => setHistoryTarget(null)} />
      <AddComponentsDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={refreshAll}
      />
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onCommitted={refreshAll}
      />
    </div>
  );
}
