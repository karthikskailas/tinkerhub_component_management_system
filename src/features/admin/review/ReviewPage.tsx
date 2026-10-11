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
import { usePendingRequests } from "./usePendingRequests";
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
    toast.success("Request approved.");
    setPickupCard(card);
    closeDetail();
  }

  function handleRejected() {
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
    <div className="flex min-h-[calc(100vh-57px)] md:flex-row">
      <div className="flex-1 px-4 py-4">
        <Header pendingCount={pending.count} connection={pending.connection} />

        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
          <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
            Pending
          </TabButton>
          <TabButton active={tab === "approved"} onClick={() => setTab("approved")}>
            Approved
          </TabButton>
        </div>

        {list.isLoading && <SkeletonLines count={6} />}

        {list.isError && (
          <p className="text-sm text-red-600">
            Couldn't load requests.{" "}
            <button type="button" className="underline" onClick={() => list.refetch()}>
              Retry
            </button>
          </p>
        )}

        {!list.isLoading && !list.isError && list.rows.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">
            {tab === "pending" ? "Nothing pending right now." : "No approved requests awaiting pickup."}
          </p>
        )}

        <div className="space-y-2">
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
          <div className="mt-4 text-center">
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
          <p className="mt-2 text-center text-xs text-slate-400">
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <p className="rounded-lg bg-white px-4 py-2 text-sm text-slate-700 shadow">Loading…</p>
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
    <div className="mb-3 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-slate-900">
        Review <span className="text-slate-400">({pendingCount} pending)</span>
      </h1>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <span
          className={`h-2 w-2 rounded-full ${connection === "live" ? "bg-emerald-500" : "bg-amber-500"}`}
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
      onClick={onClick}
      className={`min-h-11 flex-1 rounded-md text-sm font-medium transition-colors ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
      }`}
    >
      {children}
    </button>
  );
}
