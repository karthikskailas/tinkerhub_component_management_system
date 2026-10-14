import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getRequestByToken } from "./api";
import type { RequestStatus } from "./api";

export interface RequestDetail {
  id: string;
  publicToken: string;
  status: RequestStatus;
  rejectReason: string | null;
  expiresAt: string | null;
  projectName: string | null;
  items: { name: string; qty: number; approvedQty: number | null }[];
}

async function fetchRequestDetail(id: string): Promise<RequestDetail> {
  const { data: row, error } = await supabase
    .from("requests")
    .select("id, public_token, status, reject_reason, expires_at")
    .eq("id", id)
    .single();
  if (error) throw error;

  const byToken = await getRequestByToken(row.public_token);

  return {
    id: row.id,
    publicToken: row.public_token,
    status: row.status,
    rejectReason: row.reject_reason,
    expiresAt: row.expires_at,
    projectName: byToken.project_name,
    items: (byToken.items ?? []).map((item) => ({
      name: item.name,
      qty: item.qty,
      approvedQty: item.approved_qty,
    })),
  };
}

export function useRequest(id: string) {
  const queryClient = useQueryClient();
  const [fallbackPolling, setFallbackPolling] = useState(false);

  const query = useQuery({
    queryKey: ["request", id],
    queryFn: () => fetchRequestDetail(id),
    refetchInterval: fallbackPolling ? 10_000 : false,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`request-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests", filter: `id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["request", id] });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setFallbackPolling(true);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  return query;
}
