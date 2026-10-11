import { useState } from "react";
import type { ReactNode } from "react";

const EXAMPLE_IMAGE_SRC = "/guide/tinkerhub-project-example.png";

function ExampleImageModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <img
        src={EXAMPLE_IMAGE_SRC}
        alt="Example TinkerHub project page: title, description, tags, and your name under Collaborators"
        className="max-h-[80vh] max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <p className="mt-3 text-sm text-white">Example of a project page</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 min-h-11 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900"
      >
        Close
      </button>
    </div>
  );
}

// Self-contained trigger + modal so both the guide screen (tap-to-zoom
// thumbnail) and the details step ("See example" link) can reuse the exact
// same zoomed view without lifting any state up to their parents.
export function ExampleImageTrigger({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <ExampleImageModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function ExampleImageThumbnail({ className }: { className?: string }) {
  return (
    <ExampleImageTrigger className={`block w-full text-left ${className ?? ""}`}>
      <img
        src={EXAMPLE_IMAGE_SRC}
        alt="Example TinkerHub project page — tap to zoom"
        className="w-full rounded-lg border border-slate-200 object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          e.currentTarget.nextElementSibling?.classList.remove("hidden");
        }}
      />
      <div className="hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-400">
        Example image not available yet
      </div>
      <p className="mt-1 text-center text-xs text-slate-500">Example of a project page</p>
    </ExampleImageTrigger>
  );
}
