import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { SkeletonLines } from "../../../components/ui/Skeleton";
import { toast } from "../../../components/ui/Toast";
import { parseSupabaseError } from "../../../lib/errors";
import { approveRequest, createScreenshotSignedUrl, fetchRequestDetail, rejectRequest } from "./api";
import type { PickupCardData, RequestDetail } from "./api";
import { RejectDialog } from "./RejectDialog";

interface RequestDetailPanelProps {
  requestId: string;
  onClose: () => void;
  onApproved: (card: PickupCardData) => void;
  onRejected: () => void;
}

export function RequestDetailPanel({
  requestId,
  onClose,
  onApproved,
  onRejected,
}: RequestDetailPanelProps) {
  const queryClient = useQueryClient();
  const [approvedQtys, setApprovedQtys] = useState<Record<string, number>>({});
  const [screenshotUrl, setScreenshotUrl] = useState<string | null | "loading">("loading");
  const [zoomOpen, setZoomOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["request_detail", requestId],
    queryFn: () => fetchRequestDetail(requestId),
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    const defaults: Record<string, number> = {};
    for (const item of detailQuery.data.items) defaults[item.component_id] = item.qty;
    setApprovedQtys(defaults);
  }, [detailQuery.data]);

  useEffect(() => {
    // Signed URLs are short-lived and never cached — fetched fresh each
    // time the panel opens for a request, not kept around afterward.
    setScreenshotUrl("loading");
    const path = detailQuery.data?.screenshot_path;
    if (!path) {
      if (detailQuery.data) setScreenshotUrl(null);
      return;
    }
    let active = true;
    void createScreenshotSignedUrl(path).then((url) => {
      if (active) setScreenshotUrl(url);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.data?.screenshot_path]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !zoomOpen && !rejectOpen) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, zoomOpen, rejectOpen]);

  const approveMutation = useMutation({
    mutationFn: () => {
      const items = Object.entries(approvedQtys).map(([component_id, approved_qty]) => ({
        component_id,
        approved_qty,
      }));
      return approveRequest(requestId, items);
    },
    onSuccess: (card) => {
      onApproved(card);
    },
    onError: (error) => {
      const parsed = parseSupabaseError(error);
      toast.error(parsed.message);
      void detailQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["pending_requests"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectRequest(requestId, reason),
    onSuccess: () => {
      setRejectOpen(false);
      onRejected();
    },
    onError: (error) => {
      toast.error(parseSupabaseError(error).message);
      void detailQuery.refetch();
    },
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

  const detail: RequestDetail = detailQuery.data;
  const notPendingAnymore = detail.status !== "pending";
  const anyPositive = Object.values(approvedQtys).some((qty) => qty > 0);

  return (
    <DetailShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-900">{detail.requester_name}</h2>
      <a href={`tel:${detail.phone}`} className="text-sm text-indigo-600 underline">
        {detail.phone}
      </a>
      <p className="mt-1 text-xs text-slate-400">
        Submitted {new Date(detail.created_at).toLocaleString()}
      </p>

      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-900">
          {detail.project_name ?? "Untitled project"}
        </p>
        {detail.project_description && (
          <p className="mt-1 text-sm text-slate-600">{detail.project_description}</p>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-1 text-sm font-semibold text-slate-900">Screenshot</p>
        {screenshotUrl === "loading" && <p className="text-sm text-slate-500">Loading...</p>}
        {screenshotUrl === null && (
          <p className="text-sm text-slate-500">Screenshot already deleted.</p>
        )}
        {typeof screenshotUrl === "string" && (
          <button type="button" onClick={() => setZoomOpen(true)} className="block">
            <img
              src={screenshotUrl}
              alt="Request screenshot"
              className="h-32 w-32 rounded-lg border border-slate-200 object-cover"
            />
          </button>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-slate-900">Items</p>
        <div className="space-y-2">
          {detail.items.map((item) => {
            const approvedQty = approvedQtys[item.component_id] ?? 0;
            const available = item.count - item.reserved;
            const overAvailable = approvedQty > available;

            return (
              <div key={item.component_id} className="rounded-lg border border-slate-200 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.location ?? "No location"} · requested {item.qty}
                    </p>
                  </div>
                  <label className="flex shrink-0 items-center gap-1 text-sm">
                    <span className="sr-only">Approved quantity for {item.name}</span>
                    <input
                      type="number"
                      min={0}
                      max={item.qty}
                      value={approvedQty}
                      disabled={notPendingAnymore}
                      onChange={(e) => {
                        const clamped = Math.min(
                          Math.max(0, Math.round(Number(e.target.value)) || 0),
                          item.qty,
                        );
                        setApprovedQtys((prev) => ({ ...prev, [item.component_id]: clamped }));
                      }}
                      className="h-9 w-16 rounded-md border border-slate-300 text-center"
                    />
                  </label>
                </div>
                <p
                  className={`mt-1 text-xs ${overAvailable ? "font-medium text-amber-600" : "text-slate-400"}`}
                >
                  {available} available{overAvailable ? " — exceeds availability" : ""}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {notPendingAnymore && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          This request is no longer pending (status: {detail.status}). It may have just been
          handled elsewhere.
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <Button
          variant="danger"
          className="flex-1"
          disabled={notPendingAnymore || approveMutation.isPending}
          onClick={() => setRejectOpen(true)}
        >
          Reject
        </Button>
        <Button
          className="flex-1"
          disabled={notPendingAnymore || !anyPositive || approveMutation.isPending}
          loading={approveMutation.isPending}
          onClick={() => approveMutation.mutate()}
        >
          Approve
        </Button>
      </div>

      <RejectDialog
        open={rejectOpen}
        submitting={rejectMutation.isPending}
        onClose={() => setRejectOpen(false)}
        onConfirm={(reason) => rejectMutation.mutate(reason)}
      />

      <Modal open={zoomOpen} onClose={() => setZoomOpen(false)} variant="bare">
        {typeof screenshotUrl === "string" && (
          <img src={screenshotUrl} alt="Request screenshot, zoomed" className="max-h-[85vh] rounded-lg" />
        )}
      </Modal>
    </DetailShell>
  );
}

function DetailShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-white p-4 md:static md:z-auto md:w-[420px] md:border-l md:border-slate-200 md:p-4">
      <button
        type="button"
        onClick={onClose}
        className="mb-3 flex min-h-11 items-center gap-1 text-sm font-medium text-slate-600"
      >
        ← Back
      </button>
      {children}
    </div>
  );
}
