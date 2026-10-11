import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { fetchListRowById, fetchPendingCount, fetchPendingPage } from "./api";
import type { RequestListPage, RequestListRow, RequestStatus } from "./api";

const QUERY_KEY = ["pending_requests"];
const COUNT_QUERY_KEY = ["pending_requests_count"];
const POLL_INTERVAL_MS = 10_000;

type PendingData = InfiniteData<RequestListPage, string | null>;

function removeRowEverywhere(data: PendingData, id: string): PendingData {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      rows: page.rows.filter((row) => row.id !== id),
    })),
  };
}

function bumpCount(queryClient: ReturnType<typeof useQueryClient>, delta: number) {
  queryClient.setQueryData<number>(COUNT_QUERY_KEY, (prev) => Math.max(0, (prev ?? 0) + delta));
}

function upsertRow(data: PendingData, row: RequestListRow): PendingData {
  const alreadyPresent = data.pages.some((page) => page.rows.some((r) => r.id === row.id));
  if (alreadyPresent) {
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        rows: page.rows.map((r) => (r.id === row.id ? row : r)),
      })),
    };
  }

  // New arrivals are the newest by created_at, so under the ascending
  // (oldest-first) queue order they belong at the end of whatever's
  // loaded — appended to the last page rather than unshifted to the top.
  const pages = data.pages.slice();
  const lastIndex = pages.length - 1;
  pages[lastIndex] = { ...pages[lastIndex], rows: [...pages[lastIndex].rows, row] };
  return { ...data, pages };
}

export function usePendingRequests() {
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<"live" | "reconnecting">("live");

  const query = useInfiniteQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ pageParam }) => fetchPendingPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const countQuery = useQuery({ queryKey: COUNT_QUERY_KEY, queryFn: fetchPendingCount });

  useEffect(() => {
    const channel = supabase
      .channel("admin-pending-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests" },
        (payload) => {
          // Filtered here, not at the subscription level: an UPDATE that
          // moves a request OUT of 'pending' only carries the NEW row, so a
          // server-side `status=eq.pending` filter would silently swallow
          // exactly the events we need to remove it from the list.
          const newRow = payload.new as { id: string; status: RequestStatus } | null;
          const oldRow = payload.old as { id: string } | null;

          if (payload.eventType === "DELETE") {
            if (oldRow) {
              queryClient.setQueryData<PendingData>(QUERY_KEY, (data) =>
                data ? removeRowEverywhere(data, oldRow.id) : data,
              );
              bumpCount(queryClient, -1);
            }
            return;
          }

          if (!newRow) return;

          if (newRow.status !== "pending") {
            queryClient.setQueryData<PendingData>(QUERY_KEY, (data) =>
              data ? removeRowEverywhere(data, newRow.id) : data,
            );
            // Every request starts 'pending' and nothing transitions back
            // into it, so any row leaving 'pending' was counted exactly
            // once — safe to decrement unconditionally here.
            bumpCount(queryClient, -1);
            return;
          }

          if (payload.eventType === "INSERT") {
            bumpCount(queryClient, 1);
          }

          // Still/newly pending: fetch the joined row (project name, item
          // count) and splice it in, rather than refetching the whole list.
          void fetchListRowById(newRow.id).then((row) => {
            if (!row) return;
            queryClient.setQueryData<PendingData>(QUERY_KEY, (data) =>
              data ? upsertRow(data, row) : data,
            );
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("live");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("reconnecting");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (connection !== "reconnecting") return;
    const id = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: COUNT_QUERY_KEY });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [connection, queryClient]);

  const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];

  return {
    rows,
    count: countQuery.data ?? rows.length,
    isLoading: query.isLoading,
    isError: query.isError,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    connection,
  };
}
