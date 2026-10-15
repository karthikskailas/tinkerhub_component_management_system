import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { SkeletonLines } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";
import { parseSupabaseError } from "../../lib/errors";
import { getSavedRequests } from "../../lib/storage";
import { cancelRequest, resubmitRequest } from "./api";
import { ReturnCard } from "./ReturnCard";
import { StatusView } from "./StatusView";
import { useRequest } from "./useRequest";
import type { RequestDetail } from "./useRequest";

export function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const query = useRequest(id!);

  const cancelMutation = useMutation({
    mutationFn: () => cancelRequest(id!),
    onMutate: async () => {
      const previous = queryClient.getQueryData<RequestDetail>(["request", id]);
      queryClient.setQueryData<RequestDetail | undefined>(["request", id], (old) =>
        old ? { ...old, status: "cancelled" } : old,
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["request", id], context.previous);
      }
      const parsed = parseSupabaseError(error);
      if (parsed.code === "E_NOT_CANCELLABLE") {
        toast.error("This request was already reviewed.");
        void queryClient.invalidateQueries({ queryKey: ["request", id] });
      } else {
        toast.error(parsed.message);
      }
    },
  });

  const resubmitMutation = useMutation({
    mutationFn: () => resubmitRequest(id!),
    onSuccess: (result) => {
      navigate("/", { state: { resubmit: result } });
    },
    onError: (error) => {
      toast.error(parseSupabaseError(error).message);
    },
  });

  if (query.isLoading) {
    return (
      <div className="min-h-dvh bg-transparent sm:px-4 sm:py-6">
        <div className="mx-auto w-full max-w-lg p-6 sm:rounded-3xl sm:bg-surface sm:p-8 sm:shadow-surface">
          <SkeletonLines count={5} />
        </div>
      </div>
    );
  }

  // The anonymous session changed (cleared data, new device) so RLS hides this
  // row: fall back to the public status link saved on this device.
  const saved = getSavedRequests().find((r) => r.id === id);
  if (query.isError && saved) {
    return (
      <Navigate to={`/r/${saved.token}`} replace state={{ note: "Showing your saved status link" }} />
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="min-h-dvh bg-transparent sm:px-4 sm:py-6">
        <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 p-6 text-center sm:rounded-3xl sm:bg-surface sm:p-8 sm:shadow-surface">
          <p className="text-sm text-danger">We couldn't load this request. Check your connection and retry.</p>
          <Button variant="secondary" onClick={() => query.refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const request = query.data;

  return (
    <StatusView
      status={request.status}
      rejectReason={request.rejectReason}
      projectName={request.projectName}
      items={request.items}
      code={request.id.slice(0, 8).toUpperCase()}
      publicToken={request.publicToken}
      requesterName={request.requesterName}
      justSubmitted={!!(location.state as { justSubmitted?: boolean } | null)?.justSubmitted}
      expiresAt={request.expiresAt}
      isOwner
      onCancel={() => cancelMutation.mutateAsync()}
      cancelling={cancelMutation.isPending}
      onResubmit={() => resubmitMutation.mutateAsync()}
      resubmitting={resubmitMutation.isPending}
      returning={request.status === "issued" && request.returnPending && !request.returnSubmission}
      returnSlot={
        <ReturnCard
          requestId={request.id}
          token={null}
          pending={request.returnPending}
          submission={request.returnSubmission}
          invalidateKey={["request", id]}
        />
      }
    />
  );
}
