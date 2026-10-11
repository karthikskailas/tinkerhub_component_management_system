import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchComponentsMeta, fetchComponentsPage } from "./api";
import type { StockFilter } from "./api";

export const COMPONENTS_QUERY_KEY = "components";

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function useComponents(search: string, filter: StockFilter) {
  const debouncedSearch = useDebounced(search, 300);

  const query = useInfiniteQuery({
    queryKey: [COMPONENTS_QUERY_KEY, debouncedSearch, filter],
    queryFn: ({ pageParam }) =>
      fetchComponentsPage({ search: debouncedSearch, filter, after: pageParam }),
    initialPageParam: null as { name: string; id: string } | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // This page has no realtime subscription (per spec) — refetch on focus
    // instead, overriding the app-wide default of leaving it off.
    refetchOnWindowFocus: true,
  });

  const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];

  return {
    rows,
    isLoading: query.isLoading,
    isError: query.isError,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    isSearchPending: search !== debouncedSearch,
  };
}

export function useComponentsMeta() {
  return useQuery({ queryKey: [COMPONENTS_QUERY_KEY, "meta"], queryFn: fetchComponentsMeta });
}

export function useInvalidateComponents() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [COMPONENTS_QUERY_KEY] });
  };
}
