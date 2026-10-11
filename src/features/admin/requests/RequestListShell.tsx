import type { ReactNode } from "react";
import { Button } from "../../../components/ui/Button";
import { SkeletonLines } from "../../../components/ui/Skeleton";

interface RequestListShellProps<T> {
  title: string;
  countLabel?: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  headerActions?: ReactNode;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  rows: T[];
  rowKey: (row: T) => string;
  renderRow: (row: T) => ReactNode;
  emptyMessage: string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

// Shared by Issue, Returns and History: search box, optional filter chips,
// skeleton/error/empty states and "Load more" pagination. Each tab only
// supplies its own row renderer and data.
export function RequestListShell<T>({
  title,
  countLabel,
  search,
  onSearchChange,
  searchPlaceholder = "Search by code, name or phone...",
  filters,
  headerActions,
  isLoading,
  isError,
  onRetry,
  rows,
  rowKey,
  renderRow,
  emptyMessage,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: RequestListShellProps<T>) {
  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {countLabel && <p className="text-sm text-slate-500">{countLabel}</p>}
        </div>
        {headerActions && <div className="flex flex-wrap gap-2">{headerActions}</div>}
      </div>

      <input
        type="search"
        inputMode="search"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="mb-3 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {filters && <div className="mb-3">{filters}</div>}

      {isLoading && <SkeletonLines count={6} />}

      {isError && (
        <p className="text-sm text-red-600">
          Couldn't load this list.{" "}
          <button type="button" className="underline" onClick={onRetry}>
            Retry
          </button>
        </p>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-400">{emptyMessage}</p>
      )}

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={rowKey(row)}>{renderRow(row)}</div>
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="mt-4 text-center">
          <Button variant="secondary" loading={isFetchingNextPage} onClick={onLoadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
