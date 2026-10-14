import { Modal } from "../../../components/ui/Modal";
import { PickupCard } from "./PickupCard";
import type { PickupCardData } from "./api";

interface PickupCardDialogProps {
  data: PickupCardData | null;
  onClose: () => void;
}

export function PickupCardDialog({ data, onClose }: PickupCardDialogProps) {
  return (
    <Modal open={!!data} onClose={onClose} titleId="pickup-card-title">
      {data && (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="pickup-card-title" className="text-xl font-bold text-foreground">
              Component pickup card
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-default"
            >
              ✕
            </button>
          </div>
          <PickupCard data={data} />
        </>
      )}
    </Modal>
  );
}
