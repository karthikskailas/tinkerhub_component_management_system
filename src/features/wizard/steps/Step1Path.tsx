import { useState } from "react";
import { Button } from "../../../components/ui/Button";

const OPTIONS: { added: boolean; title: string; hint: string }[] = [
  { added: true, title: "Yes, I've added it", hint: "I'll enter my details next" },
  { added: false, title: "No, I haven't added it", hint: "Show me how, then I'll enter my details" },
];

function Illustration() {
  return (
    <svg viewBox="0 0 160 120" className="mx-auto h-28 w-auto" aria-hidden>
      <rect x="6" y="104" width="148" height="6" rx="3" fill="#ebebeb" />
      <rect x="52" y="8" width="56" height="96" rx="10" fill="#0a0a0a" />
      <rect x="57" y="16" width="46" height="80" rx="5" fill="#fff" />
      <rect x="63" y="24" width="34" height="6" rx="3" fill="#ebebeb" />
      <rect x="63" y="36" width="34" height="20" rx="4" fill="#c3ff16" />
      <circle cx="80" cy="76" r="11" fill="#5f5ce5" />
      <path d="M74.5 76l4 4 7-8" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="26" cy="36" r="6" fill="#ffe816" />
      <circle cx="134" cy="26" r="5" fill="#f79cff" />
      <rect x="120" y="60" width="20" height="20" rx="4" fill="#c3ff16" transform="rotate(12 130 70)" />
    </svg>
  );
}

export function Step1Path({
  initial,
  onChoose,
}: {
  initial: boolean | null;
  onChoose: (added: boolean) => void;
}) {
  const [picked, setPicked] = useState<boolean | null>(initial);

  return (
    <div className="motion-list flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">
          Have you added your project on the TinkerHub app?
        </h1>
        <p className="text-sm text-muted">
          You'll need a screenshot of your project page on the TinkerHub app.
        </p>
      </div>

      <div role="radiogroup" aria-label="Have you added your project on the TinkerHub app?" className="flex flex-col gap-3">
        {OPTIONS.map((o) => {
          const on = picked === o.added;
          return (
            <button
              key={o.title}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(o.added)}
              className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                on ? "border-accent bg-surface" : "border-transparent bg-surface shadow-surface"
              }`}
            >
              <span
                aria-hidden
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  on ? "border-accent" : "border-muted"
                }`}
              >
                {on && <span className="h-3 w-3 rounded-full bg-accent" />}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-semibold text-foreground">{o.title}</span>
                <span className="text-sm text-muted">{o.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <Illustration />

      <div className="flex flex-col items-center gap-2">
        <p role="status" className="text-sm text-muted">
          {picked !== null ? "Tap Continue when you're ready" : "Select an option to continue"}
        </p>
        <Button fullWidth disabled={picked === null} onClick={() => picked !== null && onChoose(picked)} className="rounded-full">
          Continue →
        </Button>
      </div>
    </div>
  );
}
