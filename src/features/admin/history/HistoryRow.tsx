import { memo } from "react";
import type { RequestListRow } from "../requests/api";

const STATUS_BADGE: Record<string, string> = {
  issued: "bg-indigo-100 text-indigo-700",
  returned: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-600",
  expired: "bg-amber-100 text-amber-700",
};

interface HistoryRowProps {
  row: RequestListRow;
  onOpen: (id: string) => void;
}

function HistoryRowImpl({ row, onOpen }: HistoryRowProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row.id)}
      className="block min-h-11 w-full rounded-lg border border-slate-200 bg-white p-3 text-left"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-indigo-600">{row.code}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status] ?? "bg-slate-100 text-slate-600"}`}
        >
          {row.status}
        </span>
      </div>
      <p className="text-sm font-medium text-slate-900">{row.requester_name}</p>
      <p className="text-sm text-slate-500">{row.phone}</p>
      <p className="mt-1 text-sm text-slate-700">
        {row.project_name ?? "Untitled project"} · {row.item_count} item
        {row.item_count === 1 ? "" : "s"}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {row.issued_at && <>Issued {new Date(row.issued_at).toLocaleDateString()}</>}
        {row.returned_at && <> · Returned {new Date(row.returned_at).toLocaleDateString()}</>}
      </p>
    </button>
  );
}

export const HistoryRow = memo(HistoryRowImpl);
