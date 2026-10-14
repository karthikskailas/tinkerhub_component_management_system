import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { SkeletonLines } from "../../../components/ui/Skeleton";
import { toast } from "../../../components/ui/Toast";
import { parseSupabaseError } from "../../../lib/errors";
import { useOnlineStatus } from "../../../lib/useOnlineStatus";
import { DetailShell, QtyInput, RequesterHeader, Section } from "../requests/DetailShell";
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
    <DetailShell
      onClose={onClose}
      footer={
        <>
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
        </>
      }
    >
      <RequesterHeader
        name={detail.requester_name}
        phone={detail.phone}
        project={detail.project_name ?? "Untitled project"}
        note={`Submitted ${new Date(detail.created_at).toLocaleString()}${
          detail.project_description ? ` · ${detail.project_description}` : ""
        }`}
      />

      {notPendingAnymore && (
        <p className="text-sm font-medium text-warning">
          This request is no longer pending (status: {detail.status}). It may have just been
          handled elsewhere.
        </p>
      )}
      {!isOnline && (
        <p className="text-sm font-medium text-warning">
          You're offline — approve/reject are disabled until you reconnect.
        </p>
      )}

      <Section title={`Items (${detail.items.length})`}>
        <div className="flex flex-col divide-y divide-border">
          {detail.items.map((item) => {
            const approvedQty = approvedQtys[item.component_id] ?? 0;
            const available = item.count - item.reserved;
            const overAvailable = approvedQty > available;

            return (
              <div key={item.component_id} className="flex items-end justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">{item.name}</p>
                  <p className="text-sm text-muted">
                    {item.location ?? "No location"} · requested {item.qty}
                  </p>
                  <p className={`text-sm ${overAvailable ? "font-semibold text-warning" : "text-muted"}`}>
                    {available} available{overAvailable ? " — exceeds availability" : ""}
                  </p>
                </div>
                <QtyInput
                  label="Approve"
                  value={approvedQty}
                  max={item.qty}
                  disabled={notPendingAnymore}
                  onChange={(n) => setApprovedQtys((prev) => ({ ...prev, [item.component_id]: n }))}
                />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Screenshot">
        {screenshotUrl === "loading" && <p className="text-sm text-muted">Loading...</p>}
        {screenshotUrl === null && (
          <p className="text-sm text-muted">Screenshot already deleted.</p>
        )}
        {typeof screenshotUrl === "string" && (
          <button type="button" onClick={() => setZoomOpen(true)} aria-label="Zoom screenshot">
            <img
              src={screenshotUrl}
              alt="Request screenshot"
              width={160}
              height={160}
              loading="lazy"
              className="h-40 w-40 rounded-lg object-cover"
            />
          </button>
        )}
      </Section>

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
