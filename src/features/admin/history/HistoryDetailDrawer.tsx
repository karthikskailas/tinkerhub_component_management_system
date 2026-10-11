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
        <p className="text-sm text-red-600">Couldn't load this request.</p>
        <button
          type="button"
          onClick={() => detailQuery.refetch()}
          className="mt-2 min-h-11 text-sm font-medium text-indigo-600 underline"
        >
          Retry
        </button>
      </DetailShell>
    );
  }

  const detail = detailQuery.data;

  return (
    <DetailShell onClose={onClose}>
      <p className="font-mono text-xs font-semibold text-indigo-600">{detail.code}</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">{detail.requester_name}</h2>
      <a href={`tel:${detail.phone}`} className="text-sm text-indigo-600 underline">
        {detail.phone}
      </a>
      <p className="mt-1 text-sm text-slate-700">{detail.project_name ?? "Untitled project"}</p>
      <p className="mt-1 text-xs text-slate-400">
        Submitted {new Date(detail.created_at).toLocaleString()}
      </p>

      {detail.reject_reason && (
        <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Rejected: {detail.reject_reason}
        </p>
      )}

      {/* Screenshots are cleaned up once a request leaves review, so there's
          never anything to show here for a history entry. */}
      <p className="mt-2 text-xs text-slate-400">Screenshot removed after review.</p>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-slate-900">Items</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                <th className="p-2">Component</th>
                <th className="p-2 text-right">Req.</th>
                <th className="p-2 text-right">Appr.</th>
                <th className="p-2 text-right">Issued</th>
                <th className="p-2 text-right">Returned</th>
                <th className="p-2">Condition</th>
                <th className="p-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={item.component_id} className="border-b border-slate-100">
                  <td className="p-2 text-slate-900">{item.name}</td>
                  <td className="p-2 text-right">{item.qty}</td>
                  <td className="p-2 text-right">{item.approved_qty ?? "—"}</td>
                  <td className="p-2 text-right">{item.issued_qty ?? "—"}</td>
                  <td className="p-2 text-right">{item.returned_qty ?? "—"}</td>
                  <td className="p-2 text-slate-600">{item.condition ?? "—"}</td>
                  <td className="p-2 text-slate-600">{item.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-slate-900">Timeline</p>
        {eventsQuery.isLoading && <SkeletonLines count={3} />}
        {eventsQuery.data && (
          <ul className="space-y-2">
            {eventsQuery.data.map((event) => (
              <li key={event.id} className="rounded-lg border border-slate-100 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">
                    {event.from_status ?? "—"} → {event.to_status ?? "—"}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
                {event.note && <p className="text-slate-600">{event.note}</p>}
                <p className="text-xs text-slate-400">
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
