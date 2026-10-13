import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RequestListShell } from "../requests/RequestListShell";
import { ScanCodeInput } from "../requests/ScanCodeInput";
import { useRequestList } from "../requests/useRequestList";
import { ReturnDetailPanel } from "./ReturnDetailPanel";
import { ReturnsRow } from "./ReturnsRow";

const PAGE_SIZE = 20;
const REFETCH_INTERVAL_MS = 30_000;

export function ReturnsPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const list = useRequestList({
    queryKeyPrefix: "returns_requests",
    statuses: ["issued"],
    orderColumn: "issued_at",
    ascending: true,
    pageSize: PAGE_SIZE,
    search,
    refetchIntervalMs: REFETCH_INTERVAL_MS,
  });

  function openRequest(requestId: string) {
    navigate(`/admin/returns/${requestId}`);
  }

  function closeDetail() {
    navigate("/admin/returns");
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] md:flex-row">
      <div className="flex-1">
        <RequestListShell
          title="Returns"
          countLabel={list.count !== undefined ? `${list.count} awaiting return` : undefined}
          headerActions={<ScanCodeInput onFound={openRequest} />}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by code, name or phone..."
          isLoading={list.isLoading}
          isError={list.isError}
          onRetry={() => list.refetch()}
          rows={list.rows}
          rowKey={(row) => row.id}
          renderRow={(row) => <ReturnsRow row={row} onOpen={openRequest} />}
          emptyMessage="Nothing awaiting return."
          hasNextPage={list.hasNextPage}
          isFetchingNextPage={list.isFetchingNextPage}
          onLoadMore={() => list.fetchNextPage()}
        />
      </div>

      {id && (
        <ReturnDetailPanel
          requestId={id}
          onClose={closeDetail}
          onVerified={(completed) => {
            list.invalidate();
            if (completed) closeDetail();
          }}
        />
      )}
    </div>
  );
}
