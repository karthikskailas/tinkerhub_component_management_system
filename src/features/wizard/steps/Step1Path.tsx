import type { ProjectPath } from "../types";

export function Step1Path({ onChoose }: { onChoose: (path: ProjectPath) => void }) {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">
        Is your project added on the TinkerHub app?
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        This helps us link your request to the right team.
      </p>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onChoose("registered")}
          className="rounded-xl border-2 border-slate-200 p-5 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50"
        >
          <span className="block text-base font-semibold text-slate-900">
            Yes, it's added
          </span>
          <span className="mt-1 block text-sm text-slate-500">
            I'll look it up using my phone number.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onChoose("new")}
          className="rounded-xl border-2 border-slate-200 p-5 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50"
        >
          <span className="block text-base font-semibold text-slate-900">
            No, I haven't added it
          </span>
          <span className="mt-1 block text-sm text-slate-500">
            I'll show you how, then add my details.
          </span>
        </button>
      </div>
    </div>
  );
}
