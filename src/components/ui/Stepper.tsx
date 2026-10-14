interface StepperProps {
  step: number; // 1-based
  total: number;
  labels: string[];
}

export function Stepper({ step, total, labels }: StepperProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className={`h-2 flex-1 rounded-full ${i < step ? "bg-accent" : "bg-default"}`}
          />
        ))}
      </div>
      <p aria-live="polite" className="text-sm font-medium text-muted">
        Step {step} of {total}: {labels[step - 1]}
      </p>
    </div>
  );
}
