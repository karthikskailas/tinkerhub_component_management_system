import { memo } from "react";
import { relativeTime } from "../../../lib/relativeTime";
import { handoverWait } from "../requests/api";
import type { RequestListRow } from "../requests/api";

function expiryLabel(expiresAt: string | null): { label: string; urgent: boolean } | null {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  const urgent = diffMs < 24 * 60 * 60 * 1000;
  if (diffMs <= 0) return { label: "Expired", urgent: true };
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return { label: `Expires in ${days} day${days === 1 ? "" : "s"}`, urgent };
}

interface IssueRowProps {
  row: RequestListRow;
  onOpen: (id: string) => void;
}

function IssueRowImpl({ row, onOpen }: IssueRowProps) {
  const expiry = expiryLabel(row.expires_at);
  const waiting = handoverWait(row.approved_at, row.handover_confirmed_at);

  return (
    <button
      type="button"
      onClick={() => onOpen(row.id)}
      className="flex w-full flex-col gap-1 rounded-xl bg-surface p-4 text-left shadow-surface"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-accent">{row.code}</span>
        {expiry && (
          <span className={`text-xs font-medium ${expiry.urgent ? "text-danger" : "text-muted"}`}>
            {expiry.label}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-foreground">{row.requester_name}</p>
      <p className="text-sm text-muted">{row.phone}</p>
      <p className="text-sm text-muted">
        {row.project_name ?? "Untitled project"} · {row.item_count} item
        {row.item_count === 1 ? "" : "s"}
      </p>
      {row.handover_confirmed_at && (
        <span className="mt-1 self-start rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
          Confirmed by {row.handover_confirmed_by} · {relativeTime(row.handover_confirmed_at)}
        </span>
      )}
      {waiting && (
        <span
          className={`mt-1 self-start rounded-full px-3 py-1 text-xs font-semibold ${
            waiting === "urgent" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"
          }`}
        >
          {waiting === "urgent" ? "Waiting 5 days+ for handover" : "Waiting 1 day+ for handover"}
        </span>
      )}
    </button>
  );
}

export const IssueRow = memo(IssueRowImpl);
