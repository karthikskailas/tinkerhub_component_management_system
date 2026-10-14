import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Input, Textarea } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { toast } from "../../../components/ui/Toast";
import { parseSupabaseError } from "../../../lib/errors";
import { useOnlineStatus } from "../../../lib/useOnlineStatus";
import { adjustComponent } from "./api";
import type { ComponentRow } from "./api";

interface AdjustDialogProps {
  component: ComponentRow | null;
  onClose: () => void;
  onAdjusted: () => void;
}

export function AdjustDialog({ component, onClose, onAdjusted }: AdjustDialogProps) {
  const isOnline = useOnlineStatus();
  const [newCount, setNewCount] = useState(component?.count ?? 0);
  const [reason, setReason] = useState("");

  // Reset local form state whenever a different component is opened.
  useEffect(() => {
    if (component) {
      setNewCount(component.count);
      setReason("");
    }
    // Keyed on id (not the whole object) so reopening the same component
    // after an aborted edit still resets the input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [component?.id]);

  const mutation = useMutation({
    mutationFn: () => adjustComponent(component!.id, newCount, reason.trim()),
    onSuccess: () => {
      toast.success("Count updated.");
      onAdjusted();
      handleClose();
    },
    onError: (error) => {
      toast.error(parseSupabaseError(error).message);
    },
  });

  function handleClose() {
    setReason("");
    onClose();
  }

  const belowReserved = component ? newCount < component.reserved : false;
  const valid = component && newCount >= component.reserved && reason.trim().length >= 3;

  return (
    <Modal open={!!component} onClose={handleClose} titleId="adjust-dialog-title">
      {component && (
        <>
          <h2 id="adjust-dialog-title" className="text-xl font-bold text-foreground">
            Adjust {component.name}
          </h2>
          <p className="text-sm text-muted">
            Current count {component.count} · reserved {component.reserved}
          </p>

          <div className="flex flex-col gap-4">
            <Input
              label="New count"
              type="number"
              min={component.reserved}
              value={newCount}
              onChange={(e) => setNewCount(Math.max(0, Math.round(Number(e.target.value)) || 0))}
              hint={`Can't go below reserved (${component.reserved})`}
              error={belowReserved ? `Must be at least ${component.reserved}` : undefined}
            />
            <Textarea
              label="Reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this count changing? (min 3 characters)"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={handleClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              disabled={!valid || mutation.isPending || !isOnline}
              loading={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {isOnline ? "Save" : "Offline"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
