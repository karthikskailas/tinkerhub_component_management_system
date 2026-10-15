import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { SkeletonLines } from "../../../components/ui/Skeleton";
import { AdjustDialog } from "./AdjustDialog";
import { ComponentRow } from "./ComponentRow";
import { EditDialog } from "./EditDialog";
import { ExportMenu } from "./ExportMenu";
import { HistoryDrawer } from "./HistoryDrawer";
import { FieldsDialog } from "./FieldsDialog";
import {
  useComponentFields,
  useComponents,
  useComponentsMeta,
  useInvalidateComponents,
} from "./useComponents";
import { PAGE_SIZE, PAGE_SIZE_OPTIONS } from "./api";
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
  const [editTarget, setEditTarget] = useState<ComponentRowData | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<ComponentRowData | null>(null);
  const [historyTarget, setHistoryTarget] = useState<ComponentRowData | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const [fieldsOpen, setFieldsOpen] = useState(false);

  const fieldsQuery = useComponentFields();
  const fields = useMemo(() => fieldsQuery.data ?? [], [fieldsQuery.data]);
  const customFields = useMemo(() => fields.filter((f) => !f.is_core && !f.archived), [fields]);
  const searchKeys = useMemo(
    () => customFields.filter((f) => f.searchable && f.type === "text").map((f) => f.key),
    [customFields],
  );
  const labels = useMemo(() => new Map(fields.map((f) => [f.key, f.label])), [fields]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const components = useComponents(search, filter, searchKeys, page, pageSize);
  const pageCount = Math.max(1, Math.ceil(components.total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const meta = useComponentsMeta();
  const invalidate = useInvalidateComponents();

  function refreshAll() {
    invalidate();
    void meta.refetch();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Inventory</h1>
          <p className="text-sm text-muted">
            {meta.data ? `${meta.data.total} components` : "—"}
            {meta.data?.lastUpdated && (
              <> · updated {new Date(meta.data.lastUpdated).toLocaleString()}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setFieldsOpen(true)}>
            Fields
          </Button>
          <ExportMenu search={search} filter={filter} fields={customFields} searchKeys={searchKeys} />
          <Button variant="secondary" onClick={() => setUploadOpen(true)}>
            Upload sheet
          </Button>
          <Button onClick={() => setAddOpen(true)}>Add components</Button>
        </div>
      </div>

      <input
        type="search"
        inputMode="search"
        placeholder="Search by name, location or custom fields..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-field-foreground outline-none focus:border-accent"
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f.key ? "bg-accent text-accent-foreground" : "bg-surface text-muted shadow-surface"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {components.isLoading && <SkeletonLines count={8} />}

      {components.isError && (
        <p className="text-sm text-danger">
          Couldn't load components.{" "}
          <button type="button" onClick={() => components.refetch()} className="font-medium underline">
            Retry
          </button>
        </p>
      )}

      {!components.isLoading && !components.isError && components.rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-surface p-6 text-center shadow-surface">
          <p className="text-sm text-muted">
            {search || filter !== "all" ? "No components match." : "No components yet."}
          </p>
          {!search && filter === "all" && (
            <Button onClick={() => setUploadOpen(true)}>Upload sheet</Button>
          )}
        </div>
      )}

      {components.rows.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-surface shadow-surface">
          <div className="hidden grid-cols-[1.5fr_1fr_70px_70px_70px_140px] gap-2 border-b border-border bg-background px-3 py-2 text-xs font-medium text-muted sm:grid">
            <span>{labels.get("name") ?? "Name"}</span>
            <span>{labels.get("location") ?? "Location"}</span>
            <span>{labels.get("count") ?? "Count"}</span>
            <span>Reserved</span>
            <span>Available</span>
            <span />
          </div>
          {components.rows.map((component) => (
            <ComponentRow
              key={component.id}
              component={component}
              customFields={customFields}
              onEdit={setEditTarget}
              onAdjust={setAdjustTarget}
              onHistory={setHistoryTarget}
            />
          ))}
        </div>
      )}

      {components.total > 0 && (
        <nav
          aria-label="Pagination"
          className="flex flex-wrap items-center justify-between gap-3 pt-2"
        >
          <Button
            variant="secondary"
            disabled={currentPage <= 1 || components.isFetching}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>
              Page {currentPage} of {pageCount} · {components.total} components
            </span>
            <label className="flex items-center gap-1.5">
              Rows
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="min-h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </span>
          <Button
            variant="secondary"
            disabled={currentPage >= pageCount || components.isFetching}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </nav>
      )}

      <EditDialog
        component={editTarget}
        customFields={customFields}
        onClose={() => setEditTarget(null)}
        onSaved={refreshAll}
        onAdjustCount={(c) => {
          setEditTarget(null);
          setAdjustTarget(c);
        }}
      />
      <AdjustDialog
        component={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onAdjusted={refreshAll}
      />
      <FieldsDialog open={fieldsOpen} fields={fields} onClose={() => setFieldsOpen(false)} />
      <HistoryDrawer component={historyTarget} onClose={() => setHistoryTarget(null)} />
      <AddComponentsDialog
        open={addOpen}
        customFields={customFields}
        onClose={() => setAddOpen(false)}
        onAdded={refreshAll}
      />
      <UploadDialog
        open={uploadOpen}
        fields={fields}
        onClose={() => setUploadOpen(false)}
        onCommitted={refreshAll}
      />
    </div>
  );
}
