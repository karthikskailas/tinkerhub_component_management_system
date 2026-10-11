import { useRef, useState } from "react";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Modal } from "../../../../components/ui/Modal";
import { toast } from "../../../../components/ui/Toast";
import { MAX_GRID_ROWS, useAddComponentsFlow } from "./useAddComponentsFlow";
import type { GridRow } from "./useAddComponentsFlow";
import { ProgressBar, SummaryCard } from "./UploadPrimitives";

const COLUMNS = ["name", "location", "count", "description"] as const;

interface AddComponentsDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function AddComponentsDialog({ open, onClose, onAdded }: AddComponentsDialogProps) {
  const flow = useAddComponentsFlow();
  const [reason, setReason] = useState("Manual add");
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  function cellKey(rowId: string, col: string) {
    return `${rowId}:${col}`;
  }

  function handleClose() {
    if (flow.step !== "committing" && flow.step !== "done" && flow.hasContent) {
      if (!window.confirm("Discard the rows you've entered?")) return;
    }
    flow.reset();
    setReason("Manual add");
    onClose();
  }

  function focusCell(rowIndex: number, col: string) {
    const row = flow.gridRows[rowIndex];
    if (!row) return;
    cellRefs.current.get(cellKey(row.id, col))?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent, rowIndex: number, col: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (rowIndex === flow.gridRows.length - 1) flow.addRow();
      // Give the (possibly just-added) row a tick to mount before focusing.
      setTimeout(() => focusCell(rowIndex + 1, col), 0);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return; // let normal single-cell paste through
    e.preventDefault();
    const count = flow.fillFromPaste(text);
    if (count > 0) toast.success(`Filled ${count} row${count === 1 ? "" : "s"} from paste.`);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      widthClassName="max-w-4xl"
      titleId="add-components-title"
    >
      <h2 id="add-components-title" className="text-lg font-semibold text-slate-900">
        Add components
      </h2>

      {flow.step === "grid" && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-500">
            Paste tab-separated rows (name, location, count, description, returnable) into the
            first cell to fill the grid. Max {MAX_GRID_ROWS} rows.
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <th className="p-2">Name</th>
                  <th className="p-2">Location</th>
                  <th className="p-2">Count</th>
                  <th className="p-2">Description</th>
                  <th className="p-2">Returnable</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {flow.gridRows.map((row, rowIndex) => {
                  const clientError = flow.clientErrorsByRowId.get(row.id);
                  return (
                    <tr key={row.id} className="border-b border-slate-100">
                      {COLUMNS.map((col) => (
                        <td key={col} className="p-1">
                          <input
                            ref={(el) => {
                              if (el) cellRefs.current.set(cellKey(row.id, col), el);
                              else cellRefs.current.delete(cellKey(row.id, col));
                            }}
                            value={row[col as keyof GridRow] as string}
                            onChange={(e) => flow.setRow(row.id, { [col]: e.target.value })}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, col)}
                            onPaste={rowIndex === 0 && col === "name" ? handlePaste : undefined}
                            type={col === "count" ? "number" : "text"}
                            className={`min-h-11 w-full rounded-md border px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 ${
                              clientError ? "border-red-400 bg-red-50" : "border-slate-300"
                            }`}
                            aria-invalid={!!clientError}
                          />
                        </td>
                      ))}
                      <td className="p-1 text-center">
                        <input
                          type="checkbox"
                          checked={row.returnable}
                          onChange={(e) => flow.setRow(row.id, { returnable: e.target.checked })}
                          className="h-5 w-5"
                        />
                      </td>
                      <td className="p-1">
                        <button
                          type="button"
                          onClick={() => flow.removeRow(row.id)}
                          disabled={flow.gridRows.length <= 1}
                          aria-label="Remove row"
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {flow.error && <p className="mt-2 text-sm text-red-600">{flow.error}</p>}

          <div className="mt-3 flex justify-between">
            <Button
              variant="secondary"
              onClick={flow.addRow}
              disabled={flow.gridRows.length >= MAX_GRID_ROWS}
            >
              Add row
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button disabled={!flow.hasContent} onClick={() => void flow.review()}>
                Review
              </Button>
            </div>
          </div>
        </div>
      )}

      {flow.step === "reviewing" && (
        <div className="mt-6">
          <p className="mb-2 text-sm text-slate-600">Checking rows against current stock...</p>
          <ProgressBar progress={{ done: 0, total: 1 }} />
        </div>
      )}

      {(flow.step === "review" || flow.step === "committing") && (
        <div className="mt-3">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard
              label="New"
              value={flow.reviewRows.filter((r) => r.diff === "new").length}
            />
            <SummaryCard
              label="Changed"
              value={flow.reviewRows.filter((r) => r.diff === "changed").length}
            />
            <SummaryCard
              label="Unchanged"
              value={flow.reviewRows.filter((r) => r.diff === "unchanged").length}
              muted
            />
            <SummaryCard
              label="Invalid"
              value={flow.reviewRows.filter((r) => r.diff === "invalid").length}
              warn={flow.reviewRows.some((r) => r.diff === "invalid")}
            />
          </div>

          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {flow.reviewRows.map((row) => (
              <li key={`${row.rowNumber}-${row.name}`} className="flex items-center gap-3 p-2.5 text-sm">
                <span className="w-8 shrink-0 text-xs text-slate-400">#{row.rowNumber}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{row.name}</p>
                  {row.diff === "changed" && (
                    <p className="text-xs text-amber-600">
                      Exists already: this will update the count.
                    </p>
                  )}
                </div>
                {row.diff === "invalid" ? (
                  <span className="max-w-[45%] shrink-0 truncate text-right text-xs text-red-600">
                    {row.reason}
                  </span>
                ) : (
                  <span className="shrink-0 text-right text-slate-600">
                    {row.diff === "new" ? (
                      row.newCount
                    ) : (
                      <>
                        <span className="text-slate-400">{row.oldCount}</span> →{" "}
                        <span className="font-medium">{row.newCount}</span>
                      </>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <Input
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={flow.step === "committing"}
            className="mt-3"
          />

          {flow.error && <p className="mt-2 text-sm text-red-600">{flow.error}</p>}

          <div className="mt-4 flex justify-between">
            <Button variant="secondary" onClick={flow.backToGrid} disabled={flow.step === "committing"}>
              Back to edit
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleClose} disabled={flow.step === "committing"}>
                Cancel
              </Button>
              <Button
                disabled={flow.sendableCount === 0 || reason.trim().length === 0 || flow.step === "committing"}
                loading={flow.step === "committing"}
                onClick={() => void flow.commit(reason.trim())}
              >
                Apply {flow.sendableCount} change{flow.sendableCount === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {flow.step === "done" && flow.commitResult && (
        <div className="mt-4">
          <p className="mb-3 text-sm text-slate-700">Components saved.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard label="Inserted" value={flow.commitResult.inserted} />
            <SummaryCard label="Updated" value={flow.commitResult.updated} />
            <SummaryCard label="Unchanged" value={flow.commitResult.unchanged} muted />
            <SummaryCard
              label="Invalid"
              value={flow.commitResult.invalid}
              warn={flow.commitResult.invalid > 0}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => {
                toast.success(
                  `Saved: ${flow.commitResult!.inserted} new, ${flow.commitResult!.updated} updated.`,
                );
                onAdded();
                flow.reset();
                setReason("Manual add");
                onClose();
              }}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
