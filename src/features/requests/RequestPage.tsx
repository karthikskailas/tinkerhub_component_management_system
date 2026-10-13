import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { SkeletonLines } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";
import { parseSupabaseError } from "../../lib/errors";
import { cancelRequest, resubmitRequest } from "./api";
import { StatusView } from "./StatusView";
import { useRequest } from "./useRequest";
import type { RequestDetail } from "./useRequest";

export function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
      <div className="min-h-dvh bg-white sm:bg-background sm:px-4 sm:py-6">
        <div className="mx-auto w-full max-w-lg p-6 sm:rounded-3xl sm:bg-surface sm:p-8 sm:shadow-surface">
          <SkeletonLines count={5} />
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="min-h-dvh bg-white sm:bg-background sm:px-4 sm:py-6">
        <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 p-6 text-center sm:rounded-3xl sm:bg-surface sm:p-8 sm:shadow-surface">
          <p className="text-sm text-danger">Couldn't load this request.</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="text-sm font-medium text-accent hover:underline"
          >
            Retry
          </button>
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
      isOwner
      onCancel={() => cancelMutation.mutateAsync()}
      cancelling={cancelMutation.isPending}
      onResubmit={() => resubmitMutation.mutateAsync()}
      resubmitting={resubmitMutation.isPending}
    />
  );
}
