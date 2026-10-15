import type { RequestStatus } from "../requests/api";

export const HISTORY_STATUSES: RequestStatus[] = [
  "issued",
  "returned",
  "rejected",
  "cancelled",
  "expired",
];

export const DEFAULT_HISTORY_STATUSES: RequestStatus[] = ["issued", "returned"];

export type DatePreset = "all" | "today" | "7d" | "30d" | "custom";

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  issued: "Issued",
  returned: "Returned",
  rejected: "Rejected",
  cancelled: "Cancelled",
  expired: "Expired",
};

interface HistoryFiltersProps {
  statuses: RequestStatus[];
  onStatusesChange: (statuses: RequestStatus[]) => void;
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
}

export function HistoryFilters({
  statuses,
  onStatusesChange,
  datePreset,
  onDatePresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: HistoryFiltersProps) {
  function toggleStatus(status: RequestStatus) {
    onStatusesChange(
      statuses.includes(status) ? statuses.filter((s) => s !== status) : [...statuses, status],
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {HISTORY_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => toggleStatus(status)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              statuses.includes(status) ? "bg-accent text-accent-foreground" : "bg-surface text-muted shadow-surface"
            }`}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "today", "7d", "30d", "custom"] as DatePreset[]).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onDatePresetChange(preset)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              datePreset === preset ? "border-accent text-accent" : "border-border text-muted"
            }`}
          >
            {preset === "all"
              ? "All time"
              : preset === "today"
                ? "Today"
                : preset === "7d"
                  ? "7 days"
                  : preset === "30d"
                    ? "30 days"
                    : "Custom"}
          </button>
        ))}
      </div>

      {datePreset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="min-h-11 rounded-lg border border-border bg-background px-2 text-sm text-field-foreground"
          />
          <span className="text-sm text-muted">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="min-h-11 rounded-lg border border-border bg-background px-2 text-sm text-field-foreground"
          />
        </div>
      )}
    </div>
  );
}
