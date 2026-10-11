import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { SkeletonLines } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";
import { parseSupabaseError } from "../../lib/errors";
import { supabase } from "../../lib/supabase";
import { cancelRequest, getRequestByToken, resubmitRequest } from "./api";
import { StatusView } from "./StatusView";

// RLS lets the owner (or staff) read their own row by any filter, including
// public_token, so this doubles as a cheap, backend-enforced ownership check:
// a non-owner viewing someone else's link simply gets an empty result.
async function fetchOwnRequestId(token: string): Promise<string | null> {
  const { data } = await supabase
    .from("requests")
    .select("id")
    .eq("public_token", token)
    .maybeSingle();
  return data?.id ?? null;
}

export function TokenPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["request_by_token", token],
    queryFn: () => getRequestByToken(token!),
    refetchInterval: 10_000,
  });

  const ownershipQuery = useQuery({
    queryKey: ["request_ownership", token],
    queryFn: () => fetchOwnRequestId(token!),
    retry: false,
  });

  const ownRequestId = ownershipQuery.data ?? null;

  const cancelMutation = useMutation({
    mutationFn: () => cancelRequest(ownRequestId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["request_by_token", token] });
    },
    onError: (error) => {
      const parsed = parseSupabaseError(error);
      toast.error(
        parsed.code === "E_NOT_CANCELLABLE" ? "This request was already reviewed." : parsed.message,
      );
      if (parsed.code === "E_NOT_CANCELLABLE") {
        void queryClient.invalidateQueries({ queryKey: ["request_by_token", token] });
      }
    },
  });

  const resubmitMutation = useMutation({
    mutationFn: () => resubmitRequest(ownRequestId!),
    onSuccess: (result) => {
      navigate("/", { state: { resubmit: result } });
    },
    onError: (error) => {
      toast.error(parseSupabaseError(error).message);
    },
  });

  if (statusQuery.isLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <SkeletonLines count={5} />
      </div>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 text-center">
        <p className="text-sm text-red-600">Couldn't find a request for this link.</p>
      </div>
    );
  }

  const request = statusQuery.data;

  return (
    <StatusView
      status={request.status}
      rejectReason={request.reject_reason}
      projectName={request.project_name}
      items={(request.items ?? []).map((item) => ({
        name: item.name,
        qty: item.qty,
        approvedQty: item.approved_qty,
      }))}
      isOwner={!!ownRequestId}
      onCancel={ownRequestId ? () => cancelMutation.mutateAsync() : undefined}
      cancelling={cancelMutation.isPending}
      onResubmit={ownRequestId ? () => resubmitMutation.mutateAsync() : undefined}
      resubmitting={resubmitMutation.isPending}
    />
  );
}
