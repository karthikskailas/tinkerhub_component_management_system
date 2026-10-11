import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";

const MIN_LENGTH = 3;

interface CancelApprovalDialogProps {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function CancelApprovalDialog({
  open,
  submitting,
  onClose,
  onConfirm,
}: CancelApprovalDialogProps) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN_LENGTH;

  function handleClose() {
    setReason("");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} titleId="cancel-approval-title">
      <h2 id="cancel-approval-title" className="text-lg font-semibold text-slate-900">
        Cancel this approval?
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        The reserved stock for this request will be released back to availability. This
        can't be undone.
      </p>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Reason</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          autoFocus
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Why is this approval being cancelled?"
        />
      </label>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={handleClose} disabled={submitting}>
          Back
        </Button>
        <Button
          variant="danger"
          disabled={!valid || submitting}
          loading={submitting}
          onClick={() => onConfirm(trimmed)}
        >
          Cancel approval
        </Button>
      </div>
    </Modal>
  );
}
