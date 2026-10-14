import type { ProjectPath } from "../types";

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

      <img
        src="/design-cup.webp"
        alt="Illustration of a tea cup lettered “Check in before entering”, with a QR code on the tea bag tag."
        width={2232}
        height={2153}
        decoding="async"
        className="mx-auto h-44 w-auto object-contain"
      />
    </div>
  );
}
