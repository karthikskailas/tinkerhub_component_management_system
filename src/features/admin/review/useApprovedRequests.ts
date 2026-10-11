import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchApprovedPage } from "./api";

export const APPROVED_QUERY_KEY = ["approved_requests"];

export function useApprovedRequests() {
  const query = useInfiniteQuery({
    queryKey: APPROVED_QUERY_KEY,
    queryFn: ({ pageParam }) => fetchApprovedPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
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
  };
}
