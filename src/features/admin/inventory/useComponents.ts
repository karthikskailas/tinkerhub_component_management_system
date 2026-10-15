import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  countComponents,
  fetchComponentFields,
  fetchComponentsMeta,
  fetchComponentsPage,
} from "./api";
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

export function useComponents(
  search: string,
  filter: StockFilter,
  searchKeys: string[] = [],
  page = 1,
  pageSize?: number,
) {
  const debouncedSearch = useDebounced(search, 300);
  const keys = searchKeys.join(",");

  const query = useQuery({
    queryKey: [COMPONENTS_QUERY_KEY, "page", debouncedSearch, filter, keys, page, pageSize],
    queryFn: () => fetchComponentsPage({ search: debouncedSearch, filter, searchKeys, page, pageSize }),
    // Keep the previous page on screen while the next one loads.
    placeholderData: keepPreviousData,
    // This page has no realtime subscription (per spec) — refetch on focus
    // instead, overriding the app-wide default of leaving it off.
    refetchOnWindowFocus: true,
  });

  const countQuery = useQuery({
    queryKey: [COMPONENTS_QUERY_KEY, "count", debouncedSearch, filter, keys],
    queryFn: () => countComponents({ search: debouncedSearch, filter, searchKeys }),
    placeholderData: keepPreviousData,
  });

  return {
    rows: query.data?.rows ?? [],
    total: countQuery.data ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
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

export const FIELDS_QUERY_KEY = "component_fields";

export function useComponentFields() {
  return useQuery({ queryKey: [FIELDS_QUERY_KEY], queryFn: fetchComponentFields, staleTime: 60_000 });
}
