import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { SkeletonLines } from "../../../components/ui/Skeleton";
import { toast } from "../../../components/ui/Toast";
import { parseSupabaseError } from "../../../lib/errors";
import { adminCancelRequest, fetchPickupCardData } from "./api";
import type { PickupCardData, RequestListRow } from "./api";
import { APPROVED_QUERY_KEY, useApprovedRequests } from "./useApprovedRequests";
import { CancelApprovalDialog } from "./CancelApprovalDialog";
import { dropPendingRow, usePendingRequests } from "./usePendingRequests";
import { PickupCardDialog } from "./PickupCardDialog";
import { RequestCard } from "./RequestCard";
import { RequestDetailPanel } from "./RequestDetailPanel";

type Tab = "pending" | "approved";

export function ReviewPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [pickupCard, setPickupCard] = useState<PickupCardData | null>(null);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<RequestListRow | null>(null);

  const pending = usePendingRequests();
  const approved = useApprovedRequests();

  const list = tab === "pending" ? pending : approved;

  function openRequest(requestId: string) {
    navigate(`/admin/review/${requestId}`);
  }

  function closeDetail() {
    navigate("/admin/review");
  }

  function handleApproved(card: PickupCardData) {
    dropPendingRow(queryClient, card.request_id);
    void queryClient.invalidateQueries({ queryKey: APPROVED_QUERY_KEY });
    toast.success("Request approved.");
    setPickupCard(card);
    closeDetail();
  }

  function handleRejected() {
    if (id) dropPendingRow(queryClient, id);
    toast.success("Request rejected.");
    closeDetail();
  }

  async function openPickupCardFor(row: RequestListRow) {
    setPickupLoading(true);
    try {
      const card = await fetchPickupCardData(row.id);
      setPickupCard(card);
    } catch (error) {
      toast.error(parseSupabaseError(error).message);
    } finally {
      setPickupLoading(false);
    }
  }

  const cancelMutation = useMutation({
    mutationFn: ({ row, reason }: { row: RequestListRow; reason: string }) =>
      adminCancelRequest(row.id, reason),
    onSuccess: () => {
      toast.success("Approval cancelled, stock released.");
      setCancelTarget(null);
      void queryClient.invalidateQueries({ queryKey: APPROVED_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(parseSupabaseError(error).message);
    },
  });

  return (
    <div>
      <div className="flex flex-col gap-4">
        <Header pendingCount={pending.count} connection={pending.connection} />

        <div className="flex gap-2">
          <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
            Pending
          </TabButton>
          <TabButton active={tab === "approved"} onClick={() => setTab("approved")}>
            Approved
          </TabButton>
        </div>

        {list.isLoading && <SkeletonLines count={6} />}

        {list.isError && (
          <p className="text-sm text-danger">
            Couldn't load requests.{" "}
            <button type="button" onClick={() => list.refetch()} className="font-medium underline">
              Retry
            </button>
          </p>
        )}

        {!list.isLoading && !list.isError && list.rows.length === 0 && (
          <p className="rounded-xl bg-surface p-6 text-center text-sm text-muted shadow-surface">
            {tab === "pending" ? "Nothing pending right now." : "No approved requests awaiting pickup."}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {list.rows.map((row) => (
            <RequestCard
              key={row.id}
              row={row}
              onOpen={tab === "pending" ? openRequest : () => void openPickupCardFor(row)}
              onCancelApproval={
                tab === "approved" ? () => setCancelTarget(row) : undefined
              }
            />
          ))}
        </div>

        {list.hasNextPage && (
          <div className="flex justify-center pt-2">
            <Button
              variant="secondary"
              loading={list.isFetchingNextPage}
              onClick={() => list.fetchNextPage()}
            >
              Load more
            </Button>
          </div>
        )}

        {tab === "approved" && list.rows.length > 0 && (
          <p className="text-center text-xs text-muted">
            Tap a card to reopen its pickup card.
          </p>
        )}
      </div>

      {id && (
        <RequestDetailPanel
          requestId={id}
          onClose={closeDetail}
          onApproved={handleApproved}
          onRejected={handleRejected}
        />
      )}

      <PickupCardDialog data={pickupCard} onClose={() => setPickupCard(null)} />

      <CancelApprovalDialog
        open={!!cancelTarget}
        submitting={cancelMutation.isPending}
        onClose={() => setCancelTarget(null)}
        onConfirm={(reason) => {
          if (cancelTarget) cancelMutation.mutate({ row: cancelTarget, reason });
        }}
      />

      {pickupLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-xl bg-surface px-4 py-3 text-sm font-medium text-surface-foreground shadow-overlay">
            Loading…
          </div>
        </div>
      )}
    </div>
  );
}

function Header({
  pendingCount,
  connection,
}: {
  pendingCount: number;
  connection: "live" | "reconnecting";
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold text-foreground">
        Review <span className="font-normal text-muted">({pendingCount} pending)</span>
      </h1>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <span
          data-connection={connection}
          className={`h-2 w-2 rounded-full ${connection === "live" ? "bg-success" : "bg-warning"}`}
        />
        {connection === "live" ? "Live" : "Reconnecting..."}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-active={active}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-accent text-accent-foreground" : "bg-surface text-muted shadow-surface"
      }`}
    >
      {children}
    </button>
  );
}
