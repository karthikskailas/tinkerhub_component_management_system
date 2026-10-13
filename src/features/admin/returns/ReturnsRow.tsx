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
      className="flex w-full flex-col gap-1 rounded-xl bg-surface p-4 text-left shadow-surface"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-accent">{row.code}</span>
        {days !== null && (
          <span
            data-urgency={urgency}
            className={`text-xs font-medium ${
              urgency === "red" ? "text-danger" : urgency === "amber" ? "text-warning" : "text-muted"
            }`}
          >
            {days} day{days === 1 ? "" : "s"} since issue
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-foreground">{row.requester_name}</p>
      <p className="text-sm text-muted">{row.phone}</p>
      <p className="text-sm text-muted">
        {row.project_name ?? "Untitled project"} · {row.item_count} item
        {row.item_count === 1 ? "" : "s"}
      </p>
    </button>
  );
}

export const ReturnsRow = memo(ReturnsRowImpl);
