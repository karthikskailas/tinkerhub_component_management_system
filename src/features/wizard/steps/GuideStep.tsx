import { useFocusHeading } from "../../../lib/useFocusHeading";
import { Button } from "../../../components/ui/Button";
import { ExampleImageThumbnail } from "../ExampleImage";
import { GUIDE_STEPS, TINKERHUB_URL } from "../guideContent";

const CHECKLIST = ["Your project title", "Your project description", "Your name under Collaborators"];

export function GuideStep({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const headingRef = useFocusHeading();
  return (
    <div className="motion-list flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-foreground focus:outline-none">
          Add your project on the TinkerHub app first
        </h1>
        <p className="text-sm text-muted">
          Come back here once it's added, then continue to add your details.
        </p>
      </div>

      {TINKERHUB_URL && (
        <a
          href={TINKERHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="self-start rounded-lg bg-accent-soft px-4 py-2 text-sm font-medium text-accent-soft-foreground"
        >
          Open TinkerHub
        </a>
      )}

      <ol className="flex flex-col gap-3">
        {GUIDE_STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-default text-sm font-semibold text-foreground">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">{step.title}</p>
              <p className="text-sm text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-xl bg-surface p-4 shadow-surface">
        <p className="mb-2 text-sm font-semibold text-foreground">What your screenshot must show</p>
        <ul className="flex flex-col gap-1.5">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-muted">
              <span aria-hidden className="text-success">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="[&_button]:block [&_button]:w-full">
        <ExampleImageThumbnail />
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} className="shrink-0 rounded-full">
          Back
        </Button>
        <Button onClick={onContinue} className="flex-1 rounded-full">
          Continue →
        </Button>
      </div>
    </div>
  );
}
