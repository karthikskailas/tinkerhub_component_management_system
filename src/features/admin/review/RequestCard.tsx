import { memo } from "react";
import { relativeTime } from "../../../lib/relativeTime";
import type { RequestListRow } from "./api";

interface RequestCardProps {
  row: RequestListRow;
  onOpen: (id: string) => void;
  onCancelApproval?: (row: RequestListRow) => void;
}

function RequestCardImpl({ row, onOpen, onCancelApproval }: RequestCardProps) {
  const code = row.id.slice(0, 8).toUpperCase();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <button
        type="button"
        onClick={() => onOpen(row.id)}
        className="block min-h-11 w-full text-left"
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-semibold text-indigo-600">{code}</span>
          <span className="text-xs text-slate-400">{relativeTime(row.created_at)}</span>
        </div>
        <p className="text-sm font-medium text-slate-900">{row.requester_name}</p>
        <p className="text-sm text-slate-500">{row.phone}</p>
        <p className="mt-1 text-sm text-slate-700">
          {row.project_name ?? "Untitled project"} · {row.item_count} item
          {row.item_count === 1 ? "" : "s"}
        </p>
        {row.expires_at && (
          <p className="mt-1 text-xs text-amber-600">
            Valid until {new Date(row.expires_at).toLocaleString()}
          </p>
        )}
      </button>

      {onCancelApproval && (
        <button
          type="button"
          onClick={() => onCancelApproval(row)}
          className="mt-2 min-h-11 w-full rounded-md px-3 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Cancel approval
        </button>
      )}
    </div>
  );
}

// Realtime pushes update one row at a time — memoize so a change to one
// card doesn't re-render every other card in the list.
export const RequestCard = memo(RequestCardImpl);
