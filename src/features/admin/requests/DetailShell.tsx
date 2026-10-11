import type { ReactNode } from "react";

// Side panel on desktop, full-screen sheet on mobile — shared by every
// Review/Issue/Returns/History detail view.
export function DetailShell({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-white p-4 md:static md:z-auto md:w-[420px] md:border-l md:border-slate-200 md:p-4">
      <button
        type="button"
        onClick={onClose}
        className="mb-3 flex min-h-11 items-center gap-1 text-sm font-medium text-slate-600"
      >
        ← Back
      </button>
      {children}
    </div>
  );
}
