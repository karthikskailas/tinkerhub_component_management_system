import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { SkeletonLines } from "../../../components/ui/Skeleton";
import { toast } from "../../../components/ui/Toast";
import { parseSupabaseError } from "../../../lib/errors";
import { useOnlineStatus } from "../../../lib/useOnlineStatus";
import { fetchRequestDetail, verifyReturn } from "../requests/api";
import type { ItemCondition } from "../requests/api";
import { DetailShell } from "../requests/DetailShell";
import { invalidateAfterRequestMutation } from "../requests/invalidate";

interface LineState {
  returnedQty: number;
  condition: ItemCondition | null;
  note: string;
}

interface ReturnDetailPanelProps {
  requestId: string;
  onClose: () => void;
  onVerified: (completed: boolean) => void;
}

export function ReturnDetailPanel({ requestId, onClose, onVerified }: ReturnDetailPanelProps) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["request_detail", requestId],
    queryFn: () => fetchRequestDetail(requestId),
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    const defaults: Record<string, LineState> = {};
    for (const item of detailQuery.data.items) {
      if (!item.returnable || !((item.issued_qty ?? 0) > 0)) continue;
      if (item.returned_qty !== null) continue; // already resolved
      defaults[item.component_id] = {
        returnedQty: item.issued_qty ?? 0,
        condition: null,
        note: "",
      };
    }
    setLines(defaults);
  }, [detailQuery.data]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirmOpen) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, confirmOpen]);

  const verifyMutation = useMutation({
    mutationFn: () => {
      const items = Object.entries(lines)
        .filter(([, line]) => line.condition !== null)
        .map(([component_id, line]) => ({
          component_id,
          returned_qty: line.returnedQty,
          condition: line.condition as ItemCondition,
          note: line.note.trim() || null,
        }));
      return verifyReturn(requestId, items);
    },
    onSuccess: () => {
      invalidateAfterRequestMutation(queryClient);
      void detailQuery.refetch().then((result) => {
        const completed = result.data?.status === "returned";
        toast.success(completed ? "Request completed." : "Return verified.");
        onVerified(completed);
      });
    },
    onError: (error) => {
      toast.error(parseSupabaseError(error).message);
      void detailQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["returns_requests"] });
    },
  });

  if (detailQuery.isLoading) {
    return (
      <DetailShell onClose={onClose}>
        <SkeletonLines count={6} />
      </DetailShell>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <DetailShell onClose={onClose}>
        <p className="text-sm text-danger">Couldn't load this request.</p>
        <button
          type="button"
          onClick={() => detailQuery.refetch()}
          className="text-sm font-medium text-accent hover:underline"
        >
          Retry
        </button>
      </DetailShell>
    );
  }

  const detail = detailQuery.data;
  const notIssued = detail.status !== "issued";
  const returnableItems = detail.items.filter((i) => i.returnable && (i.issued_qty ?? 0) > 0);
  const consumedItems = detail.items.filter((i) => !i.returnable && (i.issued_qty ?? 0) > 0);
  const outstanding = returnableItems.filter((i) => i.returned_qty === null);
  const touchedEntries = Object.entries(lines).filter(([, l]) => l.condition !== null);

  const summary = touchedEntries.reduce(
    (acc, [, l]) => {
      if (l.condition === "ok") acc.ok += l.returnedQty;
      else if (l.condition === "damaged") acc.damaged += l.returnedQty;
      else if (l.condition === "missing") acc.missing += l.returnedQty;
      return acc;
    },
    { ok: 0, damaged: 0, missing: 0 },
  );

  function markAllOk() {
    setLines((prev) => {
      const next = { ...prev };
      for (const item of outstanding) {
        next[item.component_id] = {
          returnedQty: item.issued_qty ?? 0,
          condition: "ok",
          note: next[item.component_id]?.note ?? "",
        };
      }
      return next;
    });
  }

  function updateLine(componentId: string, patch: Partial<LineState>) {
    setLines((prev) => ({
      ...prev,
      [componentId]: { ...prev[componentId], ...patch } as LineState,
    }));
  }

  return (
    <DetailShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-foreground">{detail.requester_name}</h2>
      <a href={`tel:${detail.phone}`} className="text-sm text-accent hover:underline">
        {detail.phone}
      </a>
      <p className="text-sm text-muted">{detail.project_name ?? "Untitled project"}</p>

      {outstanding.length > 1 && !notIssued && (
        <Button variant="secondary" onClick={markAllOk}>
          Mark all OK
        </Button>
      )}

      <div className="rounded-xl bg-surface p-4 shadow-surface">
        <p className="mb-2 text-sm font-semibold text-foreground">Returnable items</p>
        <div className="flex flex-col gap-4">
          {returnableItems.map((item) => {
            const resolved = item.returned_qty !== null;
            const line = lines[item.component_id];
            return (
              <div key={item.component_id} className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted">
                  {item.location ?? "No location"} · issued {item.issued_qty}
                </p>

                {resolved ? (
                  <p className="text-sm text-muted">
                    Returned {item.returned_qty} · {item.condition}
                    {item.note ? ` · ${item.note}` : ""}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={item.issued_qty ?? 0}
                      value={line?.returnedQty ?? 0}
                      disabled={notIssued}
                      onChange={(e) => {
                        const clamped = Math.min(
                          Math.max(0, Math.round(Number(e.target.value)) || 0),
                          item.issued_qty ?? 0,
                        );
                        updateLine(item.component_id, { returnedQty: clamped });
                      }}
                      className="h-9 w-16 rounded-md border border-field-border bg-field text-center text-sm text-field-foreground"
                    />
                    <select
                      value={line?.condition ?? ""}
                      disabled={notIssued}
                      onChange={(e) =>
                        updateLine(item.component_id, {
                          condition: (e.target.value || null) as ItemCondition | null,
                        })
                      }
                      className="h-9 rounded-md border border-field-border bg-field px-2 text-sm text-field-foreground"
                    >
                      <option value="">Select...</option>
                      <option value="ok">OK</option>
                      <option value="damaged">Damaged</option>
                      <option value="missing">Missing</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={line?.note ?? ""}
                      disabled={notIssued}
                      onChange={(e) => updateLine(item.component_id, { note: e.target.value })}
                      className="h-9 min-w-0 flex-1 rounded-md border border-field-border bg-field px-2 text-sm text-field-foreground"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {consumedItems.length > 0 && (
        <div className="rounded-xl bg-surface p-4 shadow-surface">
          <p className="mb-2 text-sm font-semibold text-foreground">Consumed (non-returnable)</p>
          <div className="flex flex-col gap-1">
            {consumedItems.map((item) => (
              <div key={item.component_id} className="text-sm text-muted">
                {item.name} × {item.issued_qty}
              </div>
            ))}
          </div>
        </div>
      )}

      {notIssued && (
        <p className="text-sm text-warning">
          This request is no longer issued (status: {detail.status}).
        </p>
      )}

      <div>
        <Button
          disabled={notIssued || touchedEntries.length === 0 || verifyMutation.isPending || !isOnline}
          onClick={() => setConfirmOpen(true)}
        >
          {isOnline ? "Verify return" : "Offline"}
        </Button>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} titleId="confirm-return-title">
        <h2 id="confirm-return-title" className="text-lg font-semibold text-foreground">
          Confirm return
        </h2>
        <ul className="flex flex-col gap-1 text-sm text-foreground">
          <li>{summary.ok} back in stock</li>
          <li>{summary.damaged} damaged</li>
          <li>{summary.missing} missing</li>
        </ul>
        <p className="text-xs text-muted">
          Damaged and missing items are not added back to stock.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={verifyMutation.isPending}>
            Cancel
          </Button>
          <Button
            loading={verifyMutation.isPending}
            onClick={() => {
              setConfirmOpen(false);
              verifyMutation.mutate();
            }}
          >
            Confirm
          </Button>
        </div>
      </Modal>
    </DetailShell>
  );
}
