import type { ProjectPath } from "../types";

export function Step1Path({ onChoose }: { onChoose: (path: ProjectPath) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">
        Is your project added on the TinkerHub app?
      </h1>
      <p className="text-sm text-muted">This helps us link your request to the right team.</p>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onChoose("registered")}
          className="flex flex-col gap-1 rounded-xl bg-surface p-4 text-left shadow-surface transition-colors hover:bg-surface-hover"
        >
          <span className="text-sm font-semibold text-foreground">Yes, it's added</span>
          <span className="text-sm text-muted">I'll look it up using my phone number.</span>
        </button>
        <button
          type="button"
          onClick={() => onChoose("new")}
          className="flex flex-col gap-1 rounded-xl bg-surface p-4 text-left shadow-surface transition-colors hover:bg-surface-hover"
        >
          <span className="text-sm font-semibold text-foreground">No, I haven't added it</span>
          <span className="text-sm text-muted">I'll show you how, then add my details.</span>
        </button>
      </div>
    </div>
  );
}
