import { memo } from "react";
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
    </button>
  );
}

export const IssueRow = memo(IssueRowImpl);
