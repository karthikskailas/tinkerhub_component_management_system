import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RequestListShell } from "../requests/RequestListShell";
import { useRequestList } from "../requests/useRequestList";
import { resolveDateRange } from "./dateRange";
import { DEFAULT_HISTORY_STATUSES, HistoryFilters } from "./HistoryFilters";
import type { DatePreset } from "./HistoryFilters";
import { HistoryExportButton } from "./HistoryExportButton";
import { HistoryDetailDrawer } from "./HistoryDetailDrawer";
import { HistoryRow } from "./HistoryRow";

const PAGE_SIZE = 25;
const ORDER_COLUMN = "updated_at" as const;

export function HistoryPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState(DEFAULT_HISTORY_STATUSES);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from: dateFrom, to: dateTo } = useMemo(
    () => resolveDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const list = useRequestList({
    queryKeyPrefix: "history_requests",
    statuses,
    orderColumn: ORDER_COLUMN,
    ascending: false,
    pageSize: PAGE_SIZE,
    search,
    searchProjects: true,
    dateFrom,
    dateTo,
  });

  function openRequest(requestId: string) {
    navigate(`/admin/history/${requestId}`);
  }

  function closeDetail() {
    navigate("/admin/history");
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] md:flex-row">
      <div className="flex-1">
        <RequestListShell
          title="History"
          countLabel={list.count !== undefined ? `${list.count} requests` : undefined}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by code, name, phone or project..."
          headerActions={
            <HistoryExportButton
              statuses={statuses}
              search={search}
              orderColumn={ORDER_COLUMN}
              dateFrom={dateFrom}
              dateTo={dateTo}
            />
          }
          filters={
            <HistoryFilters
              statuses={statuses}
              onStatusesChange={setStatuses}
              datePreset={datePreset}
              onDatePresetChange={setDatePreset}
              customFrom={customFrom}
              customTo={customTo}
              onCustomFromChange={setCustomFrom}
              onCustomToChange={setCustomTo}
            />
          }
          isLoading={list.isLoading}
          isError={list.isError}
          onRetry={() => list.refetch()}
          rows={list.rows}
          rowKey={(row) => row.id}
          renderRow={(row) => <HistoryRow row={row} onOpen={openRequest} />}
          emptyMessage="No requests match these filters."
          hasNextPage={list.hasNextPage}
          isFetchingNextPage={list.isFetchingNextPage}
          onLoadMore={() => list.fetchNextPage()}
        />
      </div>

      {id && <HistoryDetailDrawer requestId={id} onClose={closeDetail} />}
    </div>
  );
}
