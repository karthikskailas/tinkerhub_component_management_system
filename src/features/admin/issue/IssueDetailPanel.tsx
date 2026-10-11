import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { SkeletonLines } from "../../../components/ui/Skeleton";
import { toast } from "../../../components/ui/Toast";
import { parseSupabaseError } from "../../../lib/errors";
import { fetchRequestDetail, issueRequest } from "../requests/api";
import { DetailShell } from "../requests/DetailShell";
import { invalidateAfterRequestMutation } from "../requests/invalidate";
import { fetchPickupCardData } from "../review/api";
import type { PickupCardData } from "../review/api";
import { PickupCardDialog } from "../review/PickupCardDialog";

interface IssueDetailPanelProps {
  requestId: string;
  onClose: () => void;
  onIssued: () => void;
}

export function IssueDetailPanel({ requestId, onClose, onIssued }: IssueDetailPanelProps) {
  const queryClient = useQueryClient();
  const [issuedQtys, setIssuedQtys] = useState<Record<string, number>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pickupCard, setPickupCard] = useState<PickupCardData | null>(null);
  const [pickupLoading, setPickupLoading] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["request_detail", requestId],
    queryFn: () => fetchRequestDetail(requestId),
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    const defaults: Record<string, number> = {};
    for (const item of detailQuery.data.items) {
      if ((item.approved_qty ?? 0) > 0) defaults[item.component_id] = item.approved_qty ?? 0;
    }
    setIssuedQtys(defaults);
  }, [detailQuery.data]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirmOpen) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, confirmOpen]);

  const approvedLines = (detailQuery.data?.items ?? []).filter((i) => (i.approved_qty ?? 0) > 0);
  const willComplete = approvedLines.length > 0 && approvedLines.every((i) => !i.returnable);

  const issueMutation = useMutation({
    mutationFn: () => {
      const items = approvedLines.map((i) => ({
        component_id: i.component_id,
        issued_qty: issuedQtys[i.component_id] ?? i.approved_qty ?? 0,
      }));
      return issueRequest(requestId, items);
    },
    onSuccess: () => {
      toast.success(willComplete ? "Completed, nothing to return." : "Components issued.");
      invalidateAfterRequestMutation(queryClient);
      onIssued();
    },
    onError: (error) => {
      toast.error(parseSupabaseError(error).message);
      void detailQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["issue_requests"] });
    },
  });

  async function openPickupCard() {
    setPickupLoading(true);
    try {
      setPickupCard(await fetchPickupCardData(requestId));
    } catch (error) {
      toast.error(parseSupabaseError(error).message);
    } finally {
      setPickupLoading(false);
    }
  }

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
  const notApproved = detail.status !== "approved";
  const anyReduced = approvedLines.some(
    (i) => (issuedQtys[i.component_id] ?? i.approved_qty ?? 0) < (i.approved_qty ?? 0),
  );

  return (
    <DetailShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-900">{detail.requester_name}</h2>
      <a href={`tel:${detail.phone}`} className="text-sm text-indigo-600 underline">
        {detail.phone}
      </a>
      <p className="mt-1 text-sm text-slate-700">{detail.project_name ?? "Untitled project"}</p>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-slate-900">Items to issue</p>
        <div className="space-y-2">
          {approvedLines.map((item) => (
            <div key={item.component_id} className="rounded-lg border border-slate-200 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.location ?? "No location"} · approved {item.approved_qty}
                  </p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={item.approved_qty ?? 0}
                  value={issuedQtys[item.component_id] ?? 0}
                  disabled={notApproved}
                  onChange={(e) => {
                    const clamped = Math.min(
                      Math.max(0, Math.round(Number(e.target.value)) || 0),
                      item.approved_qty ?? 0,
                    );
                    setIssuedQtys((prev) => ({ ...prev, [item.component_id]: clamped }));
                  }}
                  className="h-9 w-16 shrink-0 rounded-md border border-slate-300 text-center"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {anyReduced && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Issuing less than approved releases the remaining reserved stock back to availability.
        </p>
      )}

      {notApproved && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          This request is no longer approved (status: {detail.status}).
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <Button variant="secondary" className="flex-1" loading={pickupLoading} onClick={openPickupCard}>
          View pickup card
        </Button>
        <Button
          className="flex-1"
          disabled={notApproved || approvedLines.length === 0 || issueMutation.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          Issue components
        </Button>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} titleId="confirm-issue-title">
        <h2 id="confirm-issue-title" className="text-lg font-semibold text-slate-900">
          Confirm handover
        </h2>
        <ul className="mt-3 space-y-1">
          {approvedLines.map((item) => (
            <li key={item.component_id} className="flex justify-between text-sm text-slate-700">
              <span>{item.name}</span>
              <span className="font-medium">
                {issuedQtys[item.component_id] ?? 0} / {item.approved_qty}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={issueMutation.isPending}>
            Cancel
          </Button>
          <Button
            loading={issueMutation.isPending}
            onClick={() => {
              setConfirmOpen(false);
              issueMutation.mutate();
            }}
          >
            Confirm issue
          </Button>
        </div>
      </Modal>

      <PickupCardDialog data={pickupCard} onClose={() => setPickupCard(null)} />
    </DetailShell>
  );
}
