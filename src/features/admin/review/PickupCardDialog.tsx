import { Modal } from "../../../components/ui/Modal";
import { PickupCard } from "./PickupCard";
import type { PickupCardData } from "./api";

interface PickupCardDialogProps {
  data: PickupCardData | null;
  onClose: () => void;
}

export function PickupCardDialog({ data, onClose }: PickupCardDialogProps) {
  return (
    <Modal open={!!data} onClose={onClose} widthClassName="max-w-xl" titleId="pickup-card-title">
      {data && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 id="pickup-card-title" className="sr-only">
              Component pickup card
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
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
