import { useEffect, useRef, useState } from "react";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Modal } from "../../../../components/ui/Modal";
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
  onClose: () => void;
  onCommitted: () => void;
}

export function UploadDialog({ open, onClose, onCommitted }: UploadDialogProps) {
  const flow = useUploadFlow();
  const [activeTab, setActiveTab] = useState<UploadDiff>("new");
  const [reason, setReason] = useState("");
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
    <Modal open={open} onClose={handleClose} widthClassName="max-w-3xl" titleId="upload-dialog-title">
      <h2 id="upload-dialog-title" className="text-lg font-semibold text-slate-900">
        Upload inventory sheet
      </h2>

      {flow.step === "choose" && (
        <div className="mt-4">
          <p className="mb-3 text-sm text-slate-600">
            Columns: <code>name</code> and <code>count</code> are required; <code>location</code>,{" "}
            <code>description</code>, <code>returnable</code> are optional.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={downloadTemplate}>
              Download template
            </Button>
            <Button onClick={() => fileInputRef.current?.click()}>Choose file</Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void flow.chooseFile(file);
              }}
            />
          </div>
          {flow.parseError && <p className="mt-3 text-sm text-red-600">{flow.parseError}</p>}
        </div>
      )}

      {flow.step === "previewing" && (
        <div className="mt-6">
          <p className="mb-2 text-sm text-slate-600">
            Checking rows against current stock... ({flow.previewProgress.done}/
            {flow.previewProgress.total} batches)
          </p>
          <ProgressBar progress={flow.previewProgress} />
        </div>
      )}

      {(flow.step === "preview" || flow.step === "committing") && (
        <div className="mt-4">
          {flow.ignoredColumns.length > 0 && (
            <p className="mb-3 text-xs text-slate-500">
              Ignored columns: {flow.ignoredColumns.join(", ")}
            </p>
          )}

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard label="New" value={counts.new} />
            <SummaryCard label="Changed" value={counts.changed} />
            <SummaryCard label="Unchanged" value={counts.unchanged} muted />
            <SummaryCard label="Invalid" value={counts.invalid} warn={counts.invalid > 0} />
          </div>

          <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`min-h-11 flex-1 rounded-md text-sm font-medium ${
                  activeTab === tab.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
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
              className="mt-2 min-h-11 text-sm font-medium text-indigo-600 underline"
            >
              Download invalid rows
            </button>
          )}

          <p className="mt-3 text-xs text-slate-500">
            Components missing from the sheet are never deleted. Invalid and unchanged rows are
            skipped.
          </p>

          <Input
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={flow.isCommitting}
            className="mt-3"
          />

          {flow.isCommitting && (
            <div className="mt-3">
              <p className="mb-2 text-sm text-slate-600">
                Applying changes... ({flow.commitProgress.done}/{flow.commitProgress.total} batches)
              </p>
              <ProgressBar progress={flow.commitProgress} />
            </div>
          )}

          {flow.commitError && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <p>
                Batch {flow.commitError.chunkIndex + 1} failed: {flow.commitError.message}
              </p>
              <Button className="mt-2" variant="danger" onClick={() => void flow.retryCommit()}>
                Retry from this batch
              </Button>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={handleClose} disabled={flow.isCommitting}>
              Cancel
            </Button>
            <Button
              disabled={flow.sendableCount === 0 || reason.trim().length === 0 || flow.isCommitting}
              loading={flow.isCommitting}
              onClick={() => void flow.commit(reason.trim())}
            >
              Apply {flow.sendableCount} change{flow.sendableCount === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      {flow.step === "done" && flow.commitResult && (
        <div className="mt-4">
          <p className="mb-3 text-sm text-slate-700">Upload complete.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard label="Inserted" value={flow.commitResult.inserted} />
            <SummaryCard label="Updated" value={flow.commitResult.updated} />
            <SummaryCard label="Unchanged" value={flow.commitResult.unchanged} muted />
            <SummaryCard label="Invalid" value={flow.commitResult.invalid} warn={flow.commitResult.invalid > 0} />
          </div>
          <div className="mt-4 flex justify-end">
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
