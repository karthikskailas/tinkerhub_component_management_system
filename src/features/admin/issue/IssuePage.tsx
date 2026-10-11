import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RequestListShell } from "../requests/RequestListShell";
import { useRequestList } from "../requests/useRequestList";
import { IssueDetailPanel } from "./IssueDetailPanel";
import { IssueRow } from "./IssueRow";

const PAGE_SIZE = 20;
const REFETCH_INTERVAL_MS = 30_000;

export function IssuePage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const list = useRequestList({
    queryKeyPrefix: "issue_requests",
    statuses: ["approved"],
    orderColumn: "approved_at",
    ascending: true,
    pageSize: PAGE_SIZE,
    search,
    refetchIntervalMs: REFETCH_INTERVAL_MS,
  });

  function openRequest(requestId: string) {
    navigate(`/admin/issue/${requestId}`);
  }

  function closeDetail() {
    navigate("/admin/issue");
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] md:flex-row">
      <div className="flex-1">
        <RequestListShell
          title="Issue"
          countLabel={list.count !== undefined ? `${list.count} waiting for pickup` : undefined}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by code, name or phone..."
          isLoading={list.isLoading}
          isError={list.isError}
          onRetry={() => list.refetch()}
          rows={list.rows}
          rowKey={(row) => row.id}
          renderRow={(row) => <IssueRow row={row} onOpen={openRequest} />}
          emptyMessage="Nothing waiting for pickup."
          hasNextPage={list.hasNextPage}
          isFetchingNextPage={list.isFetchingNextPage}
          onLoadMore={() => list.fetchNextPage()}
        />
      </div>

      {id && (
        <IssueDetailPanel
          requestId={id}
          onClose={closeDetail}
          onIssued={() => {
            list.invalidate();
            closeDetail();
          }}
        />
      )}
    </div>
  );
}
