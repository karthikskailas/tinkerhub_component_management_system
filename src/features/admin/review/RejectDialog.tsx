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
      <h2 id="reject-dialog-title" className="text-xl font-bold text-foreground">
        Reject request
      </h2>

      <div className="flex flex-wrap gap-2">
        {QUICK_PICKS.map((pick) => (
          <button
            key={pick}
            type="button"
            onClick={() => setReason(pick)}
            className="rounded-full bg-background px-3 py-1.5 text-sm font-medium text-muted hover:bg-default"
          >
            {pick}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Reason</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={MAX_LENGTH}
          rows={3}
          autoFocus
          placeholder="Let the requester know why (min 3 characters)"
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-field-foreground outline-none focus:border-accent"
        />
      </label>
      <p className="text-sm text-muted">{trimmed.length}/{MAX_LENGTH}</p>

      <div className="flex justify-end gap-2">
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
