import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "../../../components/ui/Toast";
import { fetchRequestDetail, findRequestIdByCode } from "../requests/api";
import { RequestListShell } from "../requests/RequestListShell";
import { ScanCodeInput } from "../requests/ScanCodeInput";
import { useRequestList } from "../requests/useRequestList";
import { IssueDetailPanel } from "./IssueDetailPanel";
import { IssueRow } from "./IssueRow";

const PAGE_SIZE = 20;
const REFETCH_INTERVAL_MS = 30_000;

export function IssuePage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const scannedCode = searchParams.get("code");

  // /admin/issue?code=XXXXXXXX: resolve the code and open that request, or say why not.
  useEffect(() => {
    if (!scannedCode) return;
    let live = true;
    (async () => {
      const found = await findRequestIdByCode(scannedCode);
      if (!live) return;
      setSearchParams({}, { replace: true });
      if (!found) {
        toast.error("No request found for that code.");
        return;
      }
      try {
        const d = await fetchRequestDetail(found);
        if (!live) return;
        if (d.status === "approved" && d.expires_at && new Date(d.expires_at) < new Date()) {
          toast.error("That approval has expired.");
        } else if (d.status === "approved") {
          navigate(`/admin/issue/${found}`, { replace: true });
        } else if (d.status === "issued" || d.status === "returned") {
          toast.error("That request was already issued.");
        } else if (d.status === "pending") {
          toast.error("That request hasn't been approved yet.");
        } else {
          toast.error(`That request is ${d.status}.`);
        }
      } catch {
        toast.error("Couldn't open that request.");
      }
    })();
    return () => {
      live = false;
    };
  }, [scannedCode, navigate, setSearchParams]);

  const list = useRequestList({
    queryKeyPrefix: "issue_requests",
    statuses: ["approved"],
    orderColumn: "approved_at",
    ascending: true,
    pageSize: PAGE_SIZE,
    search,
    confirmedOnly,
    refetchIntervalMs: REFETCH_INTERVAL_MS,
  });

  function openRequest(requestId: string) {
    navigate(`/admin/issue/${requestId}`);
  }

  function closeDetail() {
    navigate("/admin/issue");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        <RequestListShell
          title="Issue"
          countLabel={list.count !== undefined ? `${list.count} waiting for pickup` : undefined}
          headerActions={<ScanCodeInput onFound={openRequest} />}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by code, name or phone..."
          filters={
            <button
              type="button"
              aria-pressed={confirmedOnly}
              onClick={() => setConfirmedOnly((v) => !v)}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${
                confirmedOnly ? "bg-accent text-accent-foreground" : "bg-default text-foreground"
              }`}
            >
              Confirmed by staff
            </button>
          }
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
