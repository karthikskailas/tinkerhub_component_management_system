import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { SkeletonLines } from "../../../components/ui/Skeleton";
import { toast } from "../../../components/ui/Toast";
import { parseSupabaseError } from "../../../lib/errors";
import { useOnlineStatus } from "../../../lib/useOnlineStatus";
import { DetailShell } from "../requests/DetailShell";
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
  const isOnline = useOnlineStatus();
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

  const detail: RequestDetail = detailQuery.data;
  const notPendingAnymore = detail.status !== "pending";
  const anyPositive = Object.values(approvedQtys).some((qty) => qty > 0);

  return (
    <DetailShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-foreground">{detail.requester_name}</h2>
      <a href={`tel:${detail.phone}`} className="text-sm text-accent hover:underline">
        {detail.phone}
      </a>
      <p className="text-sm text-muted">
        Submitted {new Date(detail.created_at).toLocaleString()}
      </p>

      <div>
        <p className="text-sm font-medium text-foreground">
          {detail.project_name ?? "Untitled project"}
        </p>
        {detail.project_description && (
          <p className="text-sm text-muted">{detail.project_description}</p>
        )}
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-surface">
        <p className="mb-2 text-sm font-semibold text-foreground">Screenshot</p>
        {screenshotUrl === "loading" && <p className="text-sm text-muted">Loading...</p>}
        {screenshotUrl === null && (
          <p className="text-sm text-muted">Screenshot already deleted.</p>
        )}
        {typeof screenshotUrl === "string" && (
          <button type="button" onClick={() => setZoomOpen(true)}>
            <img
              src={screenshotUrl}
              alt="Request screenshot"
              width={128}
              height={128}
              loading="lazy"
              className="h-32 w-32 rounded-lg object-cover"
            />
          </button>
        )}
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-surface">
        <p className="mb-2 text-sm font-semibold text-foreground">Items</p>
        <div className="flex flex-col gap-3">
          {detail.items.map((item) => {
            const approvedQty = approvedQtys[item.component_id] ?? 0;
            const available = item.count - item.reserved;
            const overAvailable = approvedQty > available;

            return (
              <div key={item.component_id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted">
                      {item.location ?? "No location"} · requested {item.qty}
                    </p>
                  </div>
                  <label className="shrink-0">
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
                      className="h-9 w-16 rounded-md border border-field-border bg-field text-center text-sm text-field-foreground"
                    />
                  </label>
                </div>
                <p className={`text-xs ${overAvailable ? "font-medium text-warning" : "text-muted"}`}>
                  {available} available{overAvailable ? " — exceeds availability" : ""}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {notPendingAnymore && (
        <p className="text-sm text-warning">
          This request is no longer pending (status: {detail.status}). It may have just been
          handled elsewhere.
        </p>
      )}

      {!isOnline && (
        <p className="text-sm text-warning">
          You're offline — approve/reject are disabled until you reconnect.
        </p>
      )}

      <div className="flex gap-3">
        <Button
          variant="danger"
          disabled={notPendingAnymore || approveMutation.isPending || !isOnline}
          onClick={() => setRejectOpen(true)}
        >
          Reject
        </Button>
        <Button
          disabled={notPendingAnymore || !anyPositive || approveMutation.isPending || !isOnline}
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
          <img
            src={screenshotUrl}
            alt="Request screenshot, zoomed"
            loading="lazy"
            className="max-h-[80vh] max-w-full rounded-xl object-contain"
          />
        )}
      </Modal>
    </DetailShell>
  );
}
