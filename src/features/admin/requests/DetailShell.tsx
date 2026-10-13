import type { ReactNode } from "react";
import { Modal } from "../../../components/ui/Modal";

// A modal overlay — shared by every Review/Issue/Returns/History detail
// view — instead of stacking the detail below the list, so opening one
// never grows the page or forces a scroll past the list. Internal content
// scrolls on its own (capped to the viewport) if it's taller than that.
export function DetailShell({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <Modal open onClose={onClose} size="xl">
      <button
        type="button"
        onClick={onClose}
        className="self-start text-sm font-medium text-accent hover:underline"
      >
        ← Back
      </button>
      {children}
    </Modal>
  );
}
