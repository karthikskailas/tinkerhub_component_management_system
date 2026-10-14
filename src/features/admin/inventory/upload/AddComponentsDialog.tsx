import { useRef, useState } from "react";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Modal } from "../../../../components/ui/Modal";
import { toast } from "../../../../components/ui/Toast";
import { useOnlineStatus } from "../../../../lib/useOnlineStatus";
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
  const isOnline = useOnlineStatus();
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
      titleId="add-components-title"
      size="xl"
    >
      <h2 id="add-components-title" className="text-xl font-bold text-foreground">
        Add components
      </h2>

      {flow.step === "grid" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Paste tab-separated rows (name, location, count, description, returnable) into the
            first cell to fill the grid. Max {MAX_GRID_ROWS} rows.
          </p>

          <div className="overflow-x-auto rounded-xl bg-background">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
                <col className="w-[26%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border text-left text-sm font-medium text-muted">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Location</th>
                  <th className="px-2 py-2">Count</th>
                  <th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2">Returnable</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {flow.gridRows.map((row, rowIndex) => {
                  const clientError = flow.clientErrorsByRowId.get(row.id);
                  return (
                    <tr key={row.id} className="border-b border-border">
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
                            aria-invalid={!!clientError}
                            className="min-h-9 w-full rounded-md border border-field-border bg-field px-2 text-sm text-field-foreground outline-none aria-[invalid=true]:border-danger"
                          />
                        </td>
                      ))}
                      <td className="p-1 text-center">
                        <input
                          type="checkbox"
                          checked={row.returnable}
                          onChange={(e) => flow.setRow(row.id, { returnable: e.target.checked })}
                        />
                      </td>
                      <td className="p-1">
                        <button
                          type="button"
                          onClick={() => flow.removeRow(row.id)}
                          disabled={flow.gridRows.length <= 1}
                          aria-label="Remove row"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-default disabled:opacity-40"
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

          {flow.error && <p className="text-sm text-danger">{flow.error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2">
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
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">Checking rows against current stock...</p>
          <ProgressBar progress={{ done: 0, total: 1 }} />
        </div>
      )}

      {(flow.step === "review" || flow.step === "committing") && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

          <ul className="flex max-h-[min(40vh,320px)] flex-col gap-1 overflow-y-auto rounded-xl bg-background p-1">
            {flow.reviewRows.map((row) => (
              <li key={`${row.rowNumber}-${row.name}`} className="flex items-center gap-3 px-2 py-2">
                <span className="text-sm text-muted">#{row.rowNumber}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                  {row.diff === "changed" && (
                    <p className="text-sm text-muted">Exists already: this will update the count.</p>
                  )}
                </div>
                {row.diff === "invalid" ? (
                  <span className="shrink-0 text-sm text-danger">{row.reason}</span>
                ) : (
                  <span className="shrink-0 text-sm text-foreground">
                    {row.diff === "new" ? (
                      row.newCount
                    ) : (
                      <>
                        <span className="text-muted">{row.oldCount}</span> →{" "}
                        <span>{row.newCount}</span>
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
          />

          {flow.error && <p className="text-sm text-danger">{flow.error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="secondary" onClick={flow.backToGrid} disabled={flow.step === "committing"}>
              Back to edit
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleClose} disabled={flow.step === "committing"}>
                Cancel
              </Button>
              <Button
                disabled={
                  flow.sendableCount === 0 ||
                  reason.trim().length === 0 ||
                  flow.step === "committing" ||
                  !isOnline
                }
                loading={flow.step === "committing"}
                onClick={() => void flow.commit(reason.trim())}
              >
                {isOnline
                  ? `Apply ${flow.sendableCount} change${flow.sendableCount === 1 ? "" : "s"}`
                  : "Offline"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {flow.step === "done" && flow.commitResult && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground">Components saved.</p>
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
          <div className="flex justify-end">
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
