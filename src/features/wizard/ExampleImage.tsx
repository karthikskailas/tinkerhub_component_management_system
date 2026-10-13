import { useState } from "react";
import type { ReactNode } from "react";

const EXAMPLE_IMAGE_SRC = "/guide/tinkerhub-project-example.png";

function ExampleImageModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-4"
    >
      <img
        src={EXAMPLE_IMAGE_SRC}
        alt="Example TinkerHub project page: title, description, tags, and your name under Collaborators"
        loading="lazy"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[70vh] max-w-full rounded-xl object-contain"
      />
      <p className="text-sm text-white/80">Example of a project page</p>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
      >
        Close
      </button>
    </div>
  );
}

// Self-contained trigger + modal so both the guide screen (tap-to-zoom
// thumbnail) and the details step ("See example" link) can reuse the exact
// same zoomed view without lifting any state up to their parents.
export function ExampleImageTrigger({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-left">
        {children}
      </button>
      {open && <ExampleImageModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function ExampleImageThumbnail() {
  return (
    <ExampleImageTrigger>
      <img
        src={EXAMPLE_IMAGE_SRC}
        alt="Example TinkerHub project page — tap to zoom"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          e.currentTarget.nextElementSibling?.classList.remove("hidden");
        }}
        className="w-full rounded-xl border border-border object-cover"
      />
      <div className="hidden rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
        Example image not available yet
      </div>
      <p className="mt-1 text-center text-xs text-muted">Example of a project page</p>
    </ExampleImageTrigger>
  );
}
