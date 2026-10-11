import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";

const QUICK_PICKS = [
  "Screenshot unclear",
  "Project not found",
  "Wrong components",
  "Need more details",
];

const MIN_LENGTH = 3;
const MAX_LENGTH = 300;

interface RejectDialogProps {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function RejectDialog({ open, submitting, onClose, onConfirm }: RejectDialogProps) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN_LENGTH && trimmed.length <= MAX_LENGTH;

  function handleClose() {
    setReason("");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} titleId="reject-dialog-title">
      <h2 id="reject-dialog-title" className="text-lg font-semibold text-slate-900">
        Reject request
      </h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_PICKS.map((pick) => (
          <button
            key={pick}
            type="button"
            onClick={() => setReason(pick)}
            className="min-h-11 rounded-full border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            {pick}
          </button>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Reason</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={MAX_LENGTH}
          rows={3}
          autoFocus
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Let the requester know why (min 3 characters)"
        />
      </label>
      <p className="mt-1 text-xs text-slate-400">{trimmed.length}/{MAX_LENGTH}</p>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={!valid || submitting}
          loading={submitting}
          onClick={() => onConfirm(trimmed)}
        >
          Reject
        </Button>
      </div>
    </Modal>
  );
}
