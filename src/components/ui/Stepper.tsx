interface StepperProps {
  step: number; // 1-based
  total: number;
  labels: string[];
}

export function Stepper({ step, total, labels }: StepperProps) {
  return (
    <div className="mb-4">
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-indigo-600" : "bg-slate-200"}`}
          />
        ))}
      </div>
      <p className="mt-2 text-sm font-medium text-slate-500">
        Step {step} of {total}: {labels[step - 1]}
      </p>
    </div>
  );
}
