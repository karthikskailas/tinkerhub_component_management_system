import { useQuery } from "@tanstack/react-query";
import { SkeletonLines } from "../../../components/ui/Skeleton";
import { fetchRequestDetail, fetchRequestEvents } from "../requests/api";
import { DetailShell } from "../requests/DetailShell";

interface HistoryDetailDrawerProps {
  requestId: string;
  onClose: () => void;
}

export function HistoryDetailDrawer({ requestId, onClose }: HistoryDetailDrawerProps) {
  const detailQuery = useQuery({
    queryKey: ["request_detail", requestId],
    queryFn: () => fetchRequestDetail(requestId),
  });

  const eventsQuery = useQuery({
    queryKey: ["request_events", requestId],
    queryFn: () => fetchRequestEvents(requestId),
  });

  if (detailQuery.isLoading) {
    return (
      <DetailShell onClose={onClose}>
        <SkeletonLines count={6} />
      </DetailShell>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <DetailShell onClose={onClose}>
        <p className="text-sm text-danger">Couldn't load this request.</p>
        <button
          type="button"
          onClick={() => detailQuery.refetch()}
          className="text-sm font-medium text-accent hover:underline"
        >
          Retry
        </button>
      </DetailShell>
    );
  }

  const detail = detailQuery.data;

  return (
    <DetailShell onClose={onClose}>
      <p className="font-mono text-sm font-semibold text-accent">{detail.code}</p>
      <h2 className="text-lg font-semibold text-foreground">{detail.requester_name}</h2>
      <a href={`tel:${detail.phone}`} className="text-sm text-accent hover:underline">
        {detail.phone}
      </a>
      <p className="text-sm text-muted">{detail.project_name ?? "Untitled project"}</p>
      <p className="text-sm text-muted">
        Submitted {new Date(detail.created_at).toLocaleString()}
      </p>

      {detail.reject_reason && (
        <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger-soft-foreground">
          Rejected: {detail.reject_reason}
        </p>
      )}

      {/* Screenshots are cleaned up once a request leaves review, so there's
          never anything to show here for a history entry. */}
      <p className="text-xs text-muted">Screenshot removed after review.</p>

      <div className="rounded-xl bg-surface p-4 shadow-surface">
        <p className="mb-2 text-sm font-semibold text-foreground">Items</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted">
                <th className="py-2 pr-2">Component</th>
                <th className="py-2 pr-2">Req.</th>
                <th className="py-2 pr-2">Appr.</th>
                <th className="py-2 pr-2">Issued</th>
                <th className="py-2 pr-2">Returned</th>
                <th className="py-2 pr-2">Condition</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={item.component_id} className="border-b border-border text-foreground">
                  <td className="py-2 pr-2">{item.name}</td>
                  <td className="py-2 pr-2">{item.qty}</td>
                  <td className="py-2 pr-2">{item.approved_qty ?? "—"}</td>
                  <td className="py-2 pr-2">{item.issued_qty ?? "—"}</td>
                  <td className="py-2 pr-2">{item.returned_qty ?? "—"}</td>
                  <td className="py-2 pr-2">{item.condition ?? "—"}</td>
                  <td className="py-2 text-muted">{item.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-surface">
        <p className="mb-2 text-sm font-semibold text-foreground">Timeline</p>
        {eventsQuery.isLoading && <SkeletonLines count={3} />}
        {eventsQuery.data && (
          <ul className="flex flex-col gap-3">
            {eventsQuery.data.map((event) => (
              <li key={event.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {event.from_status ?? "—"} → {event.to_status ?? "—"}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
                {event.note && <p className="text-sm text-muted">{event.note}</p>}
                <p className="text-xs text-muted">
                  {event.actor_display_name ?? (event.actor_id ? event.actor_id.slice(0, 8) : "system")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DetailShell>
  );
}
