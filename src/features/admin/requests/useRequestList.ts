import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchRequestCount, fetchRequestListPage } from "./api";
import type { ListCursor, OrderColumn, RequestStatus } from "./api";

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export interface UseRequestListParams {
  queryKeyPrefix: string;
  statuses: RequestStatus[];
  orderColumn: OrderColumn;
  ascending: boolean;
  pageSize: number;
  search: string;
  searchProjects?: boolean;
  dateFrom?: string | null;
  dateTo?: string | null;
  /** Issue/Returns: refetch periodically since they have no realtime. */
  refetchIntervalMs?: number;
}

export function useRequestList(params: UseRequestListParams) {
  const queryClient = useQueryClient();
  const debouncedSearch = useDebounced(params.search, 300);

  const queryKey = [
    params.queryKeyPrefix,
    debouncedSearch,
    params.dateFrom ?? null,
    params.dateTo ?? null,
  ];

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchRequestListPage({
        statuses: params.statuses,
        search: debouncedSearch,
        searchProjects: params.searchProjects,
        orderColumn: params.orderColumn,
        ascending: params.ascending,
        pageSize: params.pageSize,
        after: pageParam,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }),
    initialPageParam: null as ListCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchOnWindowFocus: true,
    refetchInterval: params.refetchIntervalMs,
  });

  const countQuery = useQuery({
    queryKey: [params.queryKeyPrefix, "count"],
    queryFn: () => fetchRequestCount(params.statuses),
    refetchOnWindowFocus: true,
    refetchInterval: params.refetchIntervalMs,
  });

  const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: [params.queryKeyPrefix] });
  }

  return {
    rows,
    count: countQuery.data,
    isLoading: query.isLoading,
    isError: query.isError,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    invalidate,
  };
}
