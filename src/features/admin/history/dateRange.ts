import type { DatePreset } from "./HistoryFilters";

export function resolveDateRange(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
): { from: string | null; to: string | null } {
  const now = new Date();

  if (preset === "all") return { from: null, to: null };

  if (preset === "custom") {
    return {
      from: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : null,
      to: customTo ? new Date(`${customTo}T23:59:59.999`).toISOString() : null,
    };
  }

  const days = preset === "today" ? 0 : preset === "7d" ? 7 : 30;
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: null };
}
