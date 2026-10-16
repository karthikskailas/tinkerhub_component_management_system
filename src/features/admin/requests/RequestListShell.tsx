import { Input as HeroInput } from "@heroui/react";
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {countLabel && <p className="text-sm text-muted">{countLabel}</p>}
        </div>
        {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
      </div>

      <HeroInput
        type="search"
        inputMode="search"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        fullWidth
      />

      {filters && <div className="flex shrink-0 flex-wrap gap-2">{filters}</div>}

      {/* Only this region scrolls; the header, search and filters stay put. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
      {isLoading && <SkeletonLines count={6} />}

      {isError && (
        <p className="text-sm text-danger">
          Couldn't load this list.{" "}
          <button type="button" onClick={onRetry} className="font-medium underline">
            Retry
          </button>
        </p>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <p className="rounded-xl bg-surface p-6 text-center text-sm text-muted shadow-surface">{emptyMessage}</p>
      )}

      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={rowKey(row)}>{renderRow(row)}</div>
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" loading={isFetchingNextPage} onClick={onLoadMore}>
            Load more
          </Button>
        </div>
      )}
      </div>
    </div>
  );
}
