export function ProgressBar({ progress }: { progress: { done: number; total: number } }) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
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
    <div className="rounded-lg border border-slate-200 p-2.5 text-center">
      <p
        className={`text-lg font-semibold ${warn ? "text-red-600" : muted ? "text-slate-400" : "text-slate-900"}`}
      >
        {value}
      </p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
