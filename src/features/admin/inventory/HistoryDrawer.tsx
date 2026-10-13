import { useQuery } from "@tanstack/react-query";
import { Modal } from "../../../components/ui/Modal";
import { SkeletonLines } from "../../../components/ui/Skeleton";
import { fetchAdjustmentHistory } from "./api";
import type { ComponentRow } from "./api";

interface HistoryDrawerProps {
  component: ComponentRow | null;
  onClose: () => void;
}

export function HistoryDrawer({ component, onClose }: HistoryDrawerProps) {
  const query = useQuery({
    queryKey: ["inventory_adjustments", component?.id],
    queryFn: () => fetchAdjustmentHistory(component!.id),
    enabled: !!component,
  });

  return (
    <Modal
      open={!!component}
      onClose={onClose}
      titleId="history-drawer-title"
    >
      {component && (
        <>
          <h2 id="history-drawer-title" className="text-lg font-semibold text-foreground">
            History — {component.name}
          </h2>
          <p className="text-sm text-muted">Last 50 adjustments.</p>

          {query.isLoading && <SkeletonLines count={5} />}
          {query.isError && <p className="text-sm text-danger">Couldn't load history.</p>}
          {query.data && query.data.length === 0 && (
            <p className="text-sm text-muted">No adjustments yet.</p>
          )}

          {query.data && query.data.length > 0 && (
            <ul className="flex flex-col gap-3">
              {query.data.map((entry) => (
                <li key={entry.id} className="rounded-xl bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {entry.old_count ?? "—"} → {entry.new_count ?? "—"}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                  {entry.reason && <p className="mt-1 text-sm text-muted">{entry.reason}</p>}
                  <p className="mt-1 text-xs text-muted">
                    {entry.source ?? "unknown"} ·{" "}
                    {entry.actor_display_name ?? (entry.actor_id ? entry.actor_id.slice(0, 8) : "system")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
