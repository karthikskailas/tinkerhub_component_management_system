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
      <h2 id="cancel-approval-title" className="text-lg font-semibold text-foreground">
        Cancel this approval?
      </h2>
      <p className="text-sm text-muted">
        The reserved stock for this request will be released back to availability. This
        can't be undone.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Reason</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Why is this approval being cancelled?"
          className="min-h-11 w-full rounded-lg border border-field-border bg-field px-3 py-2.5 text-base text-field-foreground outline-none focus:border-field-border-focus"
        />
      </label>

      <div className="flex justify-end gap-2">
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
