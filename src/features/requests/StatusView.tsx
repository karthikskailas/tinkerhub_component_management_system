import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/Toast";
import type { RequestStatus } from "./api";

export interface StatusViewItem {
  name: string;
  qty: number;
  approvedQty: number | null;
}

interface StatusViewProps {
  status: RequestStatus;
  rejectReason: string | null;
  projectName: string | null;
  items: StatusViewItem[];
  code?: string;
  publicToken?: string;
  isOwner: boolean;
  onCancel?: () => Promise<unknown>;
  cancelling?: boolean;
  onResubmit?: () => Promise<unknown>;
  resubmitting?: boolean;
}

const STATUS_COPY: Record<RequestStatus, { title: string; body: string }> = {
  pending: {
    title: "Awaiting approval",
    body: "An admin will review your request shortly.",
  },
  approved: {
    title: "Approved",
    body: "Please wait for the inventory manager to give you the components.",
  },
  issued: {
    title: "Components issued",
    body: "Please return them to the inventory manager when finished.",
  },
  returned: {
    title: "Completed",
    body: "Thank you.",
  },
  rejected: {
    title: "Rejected: need more review",
    body: "",
  },
  cancelled: {
    title: "Request cancelled",
    body: "This request was cancelled.",
  },
  expired: {
    title: "Request expired",
    body: "The approval window for this request expired before it was issued.",
  },
};

export function StatusView({
  status,
  rejectReason,
  projectName,
  items,
  code,
  publicToken,
  isOwner,
  onCancel,
  cancelling,
  onResubmit,
  resubmitting,
}: StatusViewProps) {
  const navigate = useNavigate();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const copy = STATUS_COPY[status];

  async function copyLink() {
    if (!publicToken) return;
    const url = `${window.location.origin}/r/${publicToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Status link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {code && (
        <p className="mb-2 font-mono text-xs tracking-wide text-slate-500">#{code}</p>
      )}

      <h1 className="mb-1 text-xl font-semibold text-slate-900">{copy.title}</h1>
      {copy.body && <p className="mb-4 text-sm text-slate-600">{copy.body}</p>}

      {status === "rejected" && rejectReason && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{rejectReason}</p>
      )}

      {projectName && (
        <p className="mb-4 text-sm text-slate-500">
          Project: <span className="font-medium text-slate-700">{projectName}</span>
        </p>
      )}

      <div className="mb-6 rounded-lg border border-slate-200 p-3">
        <span className="mb-2 block text-sm font-semibold text-slate-900">Components</span>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.name} className="flex justify-between text-sm text-slate-700">
              <span>{item.name}</span>
              <span className="font-medium">
                {item.approvedQty !== null && item.approvedQty !== item.qty ? (
                  <>
                    <span className="text-slate-400 line-through">{item.qty}</span>{" "}
                    {item.approvedQty}
                  </>
                ) : (
                  item.qty
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        {publicToken && (
          <Button variant="secondary" onClick={copyLink}>
            Copy status link
          </Button>
        )}

        {isOwner && status === "pending" && onCancel && (
          <Button variant="danger" onClick={() => setConfirmingCancel(true)}>
            Cancel request
          </Button>
        )}

        {isOwner && status === "rejected" && onResubmit && (
          <Button onClick={onResubmit} loading={resubmitting}>
            Resubmit
          </Button>
        )}

        {isOwner && (status === "cancelled" || status === "expired") && (
          <Button onClick={() => navigate("/")}>Start a new request</Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmingCancel}
        title="Cancel this request?"
        description="This can't be undone. You'll need to submit a new request if you change your mind."
        confirmLabel="Cancel request"
        danger
        onCancel={() => setConfirmingCancel(false)}
        onConfirm={async () => {
          setConfirmingCancel(false);
          await onCancel?.();
        }}
      />
      {cancelling && <p className="mt-2 text-center text-sm text-slate-500">Cancelling...</p>}
    </div>
  );
}
