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

const STATUS_COPY: Record<RequestStatus, { title: string; body: string; tone: "good" | "bad" }> = {
  pending: {
    title: "Request submitted",
    body: "An admin will review your request shortly.",
    tone: "good",
  },
  approved: {
    title: "Approved",
    body: "Please wait for the inventory manager to give you the components.",
    tone: "good",
  },
  issued: {
    title: "Components issued",
    body: "Please return them to the inventory manager when finished.",
    tone: "good",
  },
  returned: {
    title: "Completed",
    body: "Thank you.",
    tone: "good",
  },
  rejected: {
    title: "Rejected: need more review",
    body: "",
    tone: "bad",
  },
  cancelled: {
    title: "Request cancelled",
    body: "This request was cancelled.",
    tone: "bad",
  },
  expired: {
    title: "Request expired",
    body: "The approval window for this request expired before it was issued.",
    tone: "bad",
  },
};

function StatusIcon({ tone }: { tone: "good" | "bad" }) {
  return (
    <div
      className={`flex h-16 w-16 items-center justify-center rounded-full ${
        tone === "good" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-8 w-8">
        {tone === "good" ? <path d="M5 13l4 4L19 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
      </svg>
    </div>
  );
}

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

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied.");
    } catch {
      toast.error("Couldn't copy the code.");
    }
  }

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
    <div className="min-h-dvh bg-white sm:bg-background sm:px-4 sm:py-6">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 p-6 text-center sm:rounded-3xl sm:bg-surface sm:p-8 sm:shadow-surface">
        <StatusIcon tone={copy.tone} />

        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">{copy.title}</h1>
          {copy.body && <p className="text-sm text-muted">{copy.body}</p>}
        </div>

        {status === "rejected" && rejectReason && (
          <p className="w-full rounded-xl bg-danger-soft p-3 text-sm text-danger-soft-foreground">
            {rejectReason}
          </p>
        )}

        {projectName && (
          <p className="text-sm text-muted">
            Project: <span className="font-medium text-foreground">{projectName}</span>
          </p>
        )}

        {code && (
          <div className="flex w-full items-center justify-between rounded-xl bg-background p-3 text-left">
            <div>
              <p className="text-xs text-muted">Request code</p>
              <p className="font-mono text-sm font-semibold text-foreground">{code}</p>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-accent shadow-surface"
            >
              Copy
            </button>
          </div>
        )}

        <div className="w-full rounded-xl bg-background p-4 text-left">
          <span className="text-sm font-semibold text-foreground">Components</span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {items.map((item) => (
              <li key={item.name} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{item.name}</span>
                <span className="text-muted">
                  {item.approvedQty !== null && item.approvedQty !== item.qty ? (
                    <>
                      <span className="line-through">{item.qty}</span> {item.approvedQty}
                    </>
                  ) : (
                    item.qty
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex w-full flex-col gap-2">
          {isOwner && status === "rejected" && onResubmit && (
            <Button onClick={onResubmit} loading={resubmitting} fullWidth className="rounded-full">
              Resubmit
            </Button>
          )}

          {isOwner && (status === "cancelled" || status === "expired") && (
            <Button onClick={() => navigate("/")} fullWidth className="rounded-full">
              Start a new request
            </Button>
          )}

          {publicToken && (
            <Button variant="secondary" onClick={copyLink} fullWidth className="rounded-full">
              Copy status link
            </Button>
          )}

          {isOwner && status === "pending" && onCancel && (
            <Button variant="danger" onClick={() => setConfirmingCancel(true)} fullWidth className="rounded-full">
              Cancel request
            </Button>
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
        {cancelling && <p className="text-sm text-muted">Cancelling...</p>}
      </div>
    </div>
  );
}
