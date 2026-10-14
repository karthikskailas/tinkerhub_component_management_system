import type { ProjectPath } from "../types";

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0 text-muted"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

const OPTION =
  "flex items-center justify-between gap-3 rounded-xl bg-surface p-4 text-left shadow-surface transition-colors hover:bg-surface-hover active:bg-surface-hover";

export function Step1Path({ onChoose }: { onChoose: (path: ProjectPath) => void }) {
  return (
    <div className="motion-list flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">
          Is your project added on the TinkerHub app?
        </h1>
        <p className="text-sm text-muted">This helps us link your request to the right team.</p>
      </div>

      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => onChoose("registered")} className={OPTION}>
          <span className="flex flex-col gap-1">
            <span className="text-base font-semibold text-foreground">Yes, it's added</span>
            <span className="text-sm text-muted">I'll look it up using my phone number.</span>
          </span>
          <Chevron />
        </button>
        <button type="button" onClick={() => onChoose("new")} className={OPTION}>
          <span className="flex flex-col gap-1">
            <span className="text-base font-semibold text-foreground">No, I haven't added it</span>
            <span className="text-sm text-muted">I'll show you how, then add my details.</span>
          </span>
          <Chevron />
        </button>
      </div>

      <p className="text-sm text-muted">
        Tap an option to continue. You'll need your phone number and a screenshot of your project
        page.
      </p>
    </div>
  );
}
