import { Button } from "../../../components/ui/Button";
import { ExampleImageThumbnail } from "../ExampleImage";
import { GUIDE_STEPS, TINKERHUB_URL } from "../guideContent";

const CHECKLIST = ["Your project title", "Your project description", "Your name under Collaborators"];

export function GuideStep({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">
        Add your project on the TinkerHub app first
      </h1>
      <p className="mb-4 text-sm text-slate-500">
        Come back here once it's added, then continue to add your details.
      </p>

      {TINKERHUB_URL && (
        <a
          href={TINKERHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="mb-4 inline-block min-h-11 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white"
        >
          Open TinkerHub
        </a>
      )}

      <ol className="mb-5 space-y-3">
        {GUIDE_STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3 rounded-lg border border-slate-200 p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-slate-900">{step.title}</p>
              <p className="text-sm text-slate-600">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mb-5 rounded-lg border border-slate-200 p-3">
        <p className="mb-2 text-sm font-semibold text-slate-900">
          What your screenshot must show
        </p>
        <ul className="space-y-1">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
              <span className="text-emerald-600">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-6">
        <ExampleImageThumbnail />
      </div>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue}>I've added my project, continue</Button>
      </div>
    </div>
  );
}
