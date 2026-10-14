interface StepperProps {
  step: number; // 1-based
  total: number;
  labels: string[];
  /** Parts within the current step, e.g. Details is 3 short screens. */
  part?: { index: number; total: number };
}

export function Stepper({ step, total, labels, part }: StepperProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className="relative h-2 flex-1 overflow-hidden rounded-full bg-default"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{
                width:
                  i < step - 1 || (i === step - 1 && !part)
                    ? "100%"
                    : i === step - 1 && part
                      ? `${(part.index / part.total) * 100}%`
                      : "0%",
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-baseline justify-between">
        <p aria-live="polite" className="text-sm font-medium text-muted">
          Step {step} of {total}: {labels[step - 1]}
          {part && ` (part ${part.index} of ${part.total})`}
        </p>
        <span aria-hidden className="text-sm font-medium text-muted">
          {Math.round((step / total) * 100)}%
        </span>
      </div>
    </div>
  );
}
