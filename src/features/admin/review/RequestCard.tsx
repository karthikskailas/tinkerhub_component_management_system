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
    <div className="rounded-xl bg-surface shadow-surface">
      <button
        type="button"
        onClick={() => onOpen(row.id)}
        className="flex w-full flex-col gap-1 p-4 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold text-accent">{code}</span>
          <span className="text-xs text-muted">{relativeTime(row.created_at)}</span>
        </div>
        <p className="text-sm font-medium text-foreground">{row.requester_name}</p>
        <p className="text-sm text-muted">{row.phone}</p>
        <p className="text-sm text-muted">
          {row.project_name ?? "Untitled project"} · {row.item_count} item
          {row.item_count === 1 ? "" : "s"}
        </p>
        {row.expires_at && (
          <p className="text-xs text-warning">
            Valid until {new Date(row.expires_at).toLocaleString()}
          </p>
        )}
      </button>

      {onCancelApproval && (
        <button
          type="button"
          onClick={() => onCancelApproval(row)}
          className="w-full border-t border-border px-4 py-2 text-left text-sm font-medium text-danger"
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
