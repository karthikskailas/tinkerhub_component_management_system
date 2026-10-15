import { useEffect, useRef, useState } from "react";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Modal } from "../../../../components/ui/Modal";
import { useOnlineStatus } from "../../../../lib/useOnlineStatus";
import type { ComponentField } from "../api";
import { PreviewTable } from "./PreviewTable";
import { downloadInvalidRows, downloadTemplate } from "./template";
import { ProgressBar, SummaryCard } from "./UploadPrimitives";
import { useUploadFlow } from "./useUploadFlow";
import type { UploadDiff } from "./useUploadFlow";

const TABS: { key: UploadDiff; label: string }[] = [
  { key: "new", label: "New" },
  { key: "changed", label: "Changed" },
  { key: "unchanged", label: "Unchanged" },
  { key: "invalid", label: "Invalid" },
];

interface UploadDialogProps {
  open: boolean;
  fields: ComponentField[];
  onClose: () => void;
  onCommitted: () => void;
}

export function UploadDialog({ open, fields, onClose, onCommitted }: UploadDialogProps) {
  const flow = useUploadFlow(fields);
  const customLabels = fields.filter((f) => !f.is_core && !f.archived).map((f) => f.label);
  const isOnline = useOnlineStatus();
  const [activeTab, setActiveTab] = useState<UploadDiff>("new");
  const [reason, setReason] = useState("");
  const [pickedColumns, setPickedColumns] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) flow.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!flow.fileName) return;
    setReason(`Sheet upload: ${flow.fileName}`);
  }, [flow.fileName]);

  useEffect(() => {
    if (!flow.isCommitting) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flow.isCommitting]);

  function handleClose() {
    if (flow.isCommitting) return; // guarded by beforeunload too, but block in-app nav as well
    flow.reset();
    onClose();
  }

  const counts = {
    new: flow.rows.filter((r) => r.diff === "new").length,
    changed: flow.rows.filter((r) => r.diff === "changed").length,
    unchanged: flow.rows.filter((r) => r.diff === "unchanged").length,
    invalid: flow.rows.filter((r) => r.diff === "invalid").length,
  };
  const invalidRows = flow.rows.filter((r) => r.diff === "invalid");

  return (
    <Modal open={open} onClose={handleClose} titleId="upload-dialog-title">
      <h2 id="upload-dialog-title" className="text-xl font-bold text-foreground">
        Upload inventory sheet
      </h2>

      {flow.step === "choose" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Columns: <code>name</code> and <code>count</code> (or <code>new count</code>, which wins when both
            are filled) are required; <code>location</code>, <code>description</code>,{" "}
            <code>returnable</code> and your own fields are optional. Empty rows are skipped, and blank description or
            returnable cells keep the stored value.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => downloadTemplate(customLabels)}>
              Download template
            </Button>
            <Button onClick={() => fileInputRef.current?.click()}>Choose file</Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void flow.chooseFile(file);
              }}
              className="hidden"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={flow.blankCountAsZero}
              onChange={(e) => void flow.setBlankCountAsZero(e.target.checked)}
            />
            Treat an empty count as 0
          </label>
          {flow.parseError && <p className="text-sm text-danger">{flow.parseError}</p>}
        </div>
      )}

      {flow.step === "previewing" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            Checking rows against current stock... ({flow.previewProgress.done}/
            {flow.previewProgress.total} batches)
          </p>
          <ProgressBar progress={flow.previewProgress} />
        </div>
      )}

      {(flow.step === "preview" || flow.step === "committing") && (
        <div className="flex flex-col gap-4">
          {flow.ignoredColumns.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl bg-background p-3">
              <p className="text-sm font-medium text-foreground">
                These columns aren't in your inventory yet. Tick the ones to add as fields:
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {flow.ignoredColumns.map((col) => (
                  <label key={col} className="flex items-center gap-1.5 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={pickedColumns.includes(col)}
                      onChange={(e) =>
                        setPickedColumns((prev) =>
                          e.target.checked ? [...prev, col] : prev.filter((c) => c !== col),
                        )
                      }
                    />
                    {col}
                  </label>
                ))}
              </div>
              <Button
                variant="secondary"
                className="self-start"
                disabled={pickedColumns.length === 0 || !isOnline}
                onClick={() => {
                  const picked = pickedColumns;
                  setPickedColumns([]);
                  void flow.addIgnoredAsFields(picked);
                }}
              >
                Add {pickedColumns.length || ""} selected as fields
              </Button>
              <p className="text-xs text-muted">Unticked columns are skipped. Only admins can add fields.</p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={flow.blankCountAsZero}
              onChange={(e) => void flow.setBlankCountAsZero(e.target.checked)}
            />
            Treat an empty count as 0
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard label="New" value={counts.new} />
            <SummaryCard label="Changed" value={counts.changed} />
            <SummaryCard label="Unchanged" value={counts.unchanged} muted />
            <SummaryCard label="Invalid" value={counts.invalid} warn={counts.invalid > 0} />
          </div>

          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  activeTab === tab.key ? "bg-accent text-accent-foreground" : "bg-background text-muted"
                }`}
              >
                {tab.label} ({counts[tab.key]})
              </button>
            ))}
          </div>

          <PreviewTable rows={flow.rows.filter((r) => r.diff === activeTab)} />

          {invalidRows.length > 0 && (
            <button
              type="button"
              onClick={() => downloadInvalidRows(invalidRows)}
              className="self-start text-sm font-medium text-accent hover:underline"
            >
              Download invalid rows
            </button>
          )}

          <p className="text-sm text-muted">
            Components missing from the sheet are never deleted. Invalid and unchanged rows are
            skipped.
          </p>

          <Input
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={flow.isCommitting}
          />

          {flow.isCommitting && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                Applying changes... ({flow.commitProgress.done}/{flow.commitProgress.total} batches)
              </p>
              <ProgressBar progress={flow.commitProgress} />
            </div>
          )}

          {flow.commitError && (
            <div className="flex flex-col gap-2 rounded-xl bg-danger-soft p-3">
              <p className="text-sm text-danger-soft-foreground">
                Batch {flow.commitError.chunkIndex + 1} failed: {flow.commitError.message}
              </p>
              <Button variant="danger" onClick={() => void flow.retryCommit()}>
                Retry from this batch
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={handleClose} disabled={flow.isCommitting}>
              Cancel
            </Button>
            <Button
              disabled={
                flow.sendableCount === 0 ||
                reason.trim().length === 0 ||
                flow.isCommitting ||
                !isOnline
              }
              loading={flow.isCommitting}
              onClick={() => void flow.commit(reason.trim())}
            >
              {isOnline
                ? `Apply ${flow.sendableCount} change${flow.sendableCount === 1 ? "" : "s"}`
                : "Offline"}
            </Button>
          </div>
        </div>
      )}

      {flow.step === "done" && flow.commitResult && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground">Upload complete.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard label="Inserted" value={flow.commitResult.inserted} />
            <SummaryCard label="Updated" value={flow.commitResult.updated} />
            <SummaryCard label="Unchanged" value={flow.commitResult.unchanged} muted />
            <SummaryCard label="Invalid" value={flow.commitResult.invalid} warn={flow.commitResult.invalid > 0} />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                onCommitted();
                flow.reset();
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
