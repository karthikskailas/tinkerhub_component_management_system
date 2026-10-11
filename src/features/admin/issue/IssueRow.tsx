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
      className="block min-h-11 w-full rounded-lg border border-slate-200 bg-white p-3 text-left"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-indigo-600">{row.code}</span>
        {expiry && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              expiry.urgent ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {expiry.label}
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

export const IssueRow = memo(IssueRowImpl);
