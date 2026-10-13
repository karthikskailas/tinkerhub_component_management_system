export function ProgressBar({ progress }: { progress: { done: number; total: number } }) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-default">
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SummaryCard({
  label,
  value,
  muted,
  warn,
}: {
  label: string;
  value: number;
  muted?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface p-3 text-center shadow-surface">
      <p
        data-muted={muted}
        data-warn={warn}
        className={`text-xl font-semibold ${warn ? "text-danger" : muted ? "text-muted" : "text-foreground"}`}
      >
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
