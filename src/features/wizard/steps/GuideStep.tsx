import { useState } from "react";
import { useFocusHeading } from "../../../lib/useFocusHeading";
import { Button } from "../../../components/ui/Button";
import { GUIDE_PLACEHOLDER, GUIDE_STEPS, TINKERHUB_URL } from "../guideContent";

const CHECKLIST = ["Your project title", "Your project description", "Your name under Collaborators"];

// The whole guide lives on one screen: the screenshot takes whatever height
// is left, and a single Back / Next pair walks through the sub-steps and then
// hands over to the wizard (no nested buttons, no page scroll).
export function GuideStep({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const headingRef = useFocusHeading();
  const [index, setIndex] = useState(0);
  const [missing, setMissing] = useState<Set<string>>(new Set());

  const step = GUIDE_STEPS[index];
  const last = index === GUIDE_STEPS.length - 1;

  return (
    <div className="motion-list flex flex-1 flex-col gap-2.5">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-bold leading-tight text-foreground focus:outline-none"
      >
        Add your project on the TinkerHub app first
      </h1>

      <div className="flex min-h-32 flex-1 gap-2">
        {step.images.map((src) => {
          const broken = missing.has(src);
          return (
            <div key={src} className="relative min-w-0 flex-1 overflow-hidden rounded-xl bg-background">
              <img
                src={broken ? GUIDE_PLACEHOLDER : src}
                alt={broken ? "Screenshot coming soon" : `Screenshot for: ${step.title}`}
                onError={() => setMissing((prev) => new Set(prev).add(src))}
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
          );
        })}
      </div>

      <div aria-live="polite" className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">{step.title}</h2>
          <p className="shrink-0 text-sm tabular-nums text-muted">
            {index + 1} / {GUIDE_STEPS.length}
          </p>
        </div>
        <p className="text-sm text-muted">{step.body}</p>
      </div>

      {last && (
        <ul className="flex flex-col gap-0.5 rounded-xl bg-background px-3 py-2">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-foreground">
              <span aria-hidden className="text-success">✓</span>
              {item}
            </li>
          ))}
        </ul>
      )}

      {index === 0 && (
        <a
          href={TINKERHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent-soft px-5 text-sm font-semibold text-accent-soft-foreground"
        >
          Open TinkerHub
        </a>
      )}

      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={() => (index === 0 ? onBack() : setIndex(index - 1))}
          className="shrink-0 rounded-full"
        >
          Back
        </Button>
        <Button onClick={() => (last ? onContinue() : setIndex(index + 1))} className="flex-1 rounded-full">
          {last ? "I have my screenshot →" : "Next →"}
        </Button>
      </div>
    </div>
  );
}
