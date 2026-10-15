import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

const EXAMPLE_IMAGE_SRC = "/guide/step-7.webp";

function ExampleImageModal({ onClose }: { onClose: () => void }) {
  // Esc closes it, and the page behind stops scrolling while it's open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Portalled to <body>: an ancestor with an entrance transform would
  // otherwise turn `fixed` into "fixed to that ancestor", not the screen.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed left-0 top-0 z-50 flex h-[var(--app-h,100dvh)] w-full flex-col items-center justify-center gap-3 bg-black/80 p-4"
    >
      <img
        src={EXAMPLE_IMAGE_SRC}
        alt="Example TinkerHub project page: title, description, tags, and your name under Collaborators"
        loading="lazy"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[70dvh] max-w-full rounded-xl object-contain"
      />
      <p className="text-sm text-white/80">Example of a project page</p>
      <button
        type="button"
        onClick={onClose}
        className="min-h-11 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
      >
        Close
      </button>
    </div>,
    document.body,
  );
}

// Self-contained trigger + modal so both the guide screen (tap-to-zoom
// thumbnail) and the details step ("See example" link) can reuse the exact
// same zoomed view without lifting any state up to their parents.
export function ExampleImageTrigger({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex min-h-11 min-w-11 items-center justify-center text-left ${className}`}
      >
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
      <p className="mt-1 text-center text-sm text-muted">Example of a project page</p>
    </ExampleImageTrigger>
  );
}
