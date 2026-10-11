import { memo } from "react";
import type { RequestListRow } from "../requests/api";

const AMBER_AFTER_DAYS = 7;
const RED_AFTER_DAYS = 14;

function daysSince(issuedAt: string | null): number | null {
  if (!issuedAt) return null;
  return Math.floor((Date.now() - new Date(issuedAt).getTime()) / (24 * 60 * 60 * 1000));
}

interface ReturnsRowProps {
  row: RequestListRow;
  onOpen: (id: string) => void;
}

function ReturnsRowImpl({ row, onOpen }: ReturnsRowProps) {
  const days = daysSince(row.issued_at);
  const urgency = days === null ? null : days >= RED_AFTER_DAYS ? "red" : days >= AMBER_AFTER_DAYS ? "amber" : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(row.id)}
      className="block min-h-11 w-full rounded-lg border border-slate-200 bg-white p-3 text-left"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-indigo-600">{row.code}</span>
        {days !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              urgency === "red"
                ? "bg-red-100 text-red-700"
                : urgency === "amber"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {days} day{days === 1 ? "" : "s"} since issue
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-slate-900">{row.requester_name}</p>
      <p className="text-sm text-slate-500">{row.phone}</p>
      <p className="mt-1 text-sm text-slate-700">
        {row.project_name ?? "Untitled project"} · {row.item_count} item
        {row.item_count === 1 ? "" : "s"}
      </p>
    </button>
  );
}

export const ReturnsRow = memo(ReturnsRowImpl);
