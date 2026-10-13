import { memo } from "react";
import type { RequestListRow } from "../requests/api";

const STATUS_COLOR: Record<string, string> = {
  issued: "text-accent",
  returned: "text-success",
  rejected: "text-danger",
  cancelled: "text-muted",
  expired: "text-warning",
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
      className="flex w-full flex-col gap-1 rounded-xl bg-surface p-4 text-left shadow-surface"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-accent">{row.code}</span>
        <span data-status={row.status} className={`text-xs font-medium capitalize ${STATUS_COLOR[row.status] ?? "text-muted"}`}>
          {row.status}
        </span>
      </div>
      <p className="text-sm font-medium text-foreground">{row.requester_name}</p>
      <p className="text-sm text-muted">{row.phone}</p>
      <p className="text-sm text-muted">
        {row.project_name ?? "Untitled project"} · {row.item_count} item
        {row.item_count === 1 ? "" : "s"}
      </p>
      <p className="text-xs text-muted">
        {row.issued_at && <>Issued {new Date(row.issued_at).toLocaleDateString()}</>}
        {row.returned_at && <> · Returned {new Date(row.returned_at).toLocaleDateString()}</>}
      </p>
    </button>
  );
}

export const HistoryRow = memo(HistoryRowImpl);
