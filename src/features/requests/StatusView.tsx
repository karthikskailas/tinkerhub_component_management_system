import { useEffect, useState } from "react";
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
  /** When an approved request stops being collectable (ISO), if known. */
  expiresAt?: string | null;
  isOwner: boolean;
  onCancel?: () => Promise<unknown>;
  cancelling?: boolean;
  onResubmit?: () => Promise<unknown>;
  resubmitting?: boolean;
}

type StatusIconKind = "check" | "alert" | "clock" | "dash";

const STATUS_COPY: Record<RequestStatus, { title: string; body: string; icon: StatusIconKind }> = {
  pending: {
    title: "Request submitted",
    body: "Waiting for review. This page updates by itself, so you can keep it open or come back with your status link.",
    icon: "check",
  },
  approved: {
    title: "Approved: collect your components",
    body: "Show your request code to the inventory manager in person to receive your components.",
    icon: "check",
  },
  issued: {
    title: "Components issued",
    body: "Return them to the inventory manager when you're done with your project.",
    icon: "check",
  },
  returned: {
    title: "Returned. All done",
    body: "Thanks for bringing everything back.",
    icon: "check",
  },
  rejected: {
    title: "This request needs a change",
    body: "Read the reviewer's note below, update your request, and send it again.",
    icon: "alert",
  },
  cancelled: {
    title: "You cancelled this request",
    body: "No components were held for you. Start a new request whenever you need one.",
    icon: "dash",
  },
  expired: {
    title: "This approval ran out",
    body: "The components weren't collected in time and went back to stock. An expired request can't be reopened, so start a new one.",
    icon: "clock",
  },
};

// Pickup place and hours are set per deployment (VITE_PICKUP_INFO) so they can
// change without a code edit. Until set, say honestly that it isn't announced here.
const PICKUP_INFO: string | undefined = import.meta.env.VITE_PICKUP_INFO || undefined;
const PICKUP_FALLBACK =
  "The inventory manager will confirm where and when to collect.";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

const TRACK: { status: RequestStatus; label: string }[] = [
  { status: "pending", label: "Submitted" },
  { status: "approved", label: "Approved" },
  { status: "issued", label: "Issued" },
  { status: "returned", label: "Returned" },
];

function LifecycleTrack({ status }: { status: RequestStatus }) {
  const current = TRACK.findIndex((t) => t.status === status);
  if (current < 0) return null;
  return (
    <ol className="flex w-full gap-1.5" aria-label="Request progress">
      {TRACK.map((t, i) => (
        <li key={t.status} aria-current={i === current ? "step" : undefined} className="flex flex-1 flex-col gap-1.5">
          <span className={`h-1.5 rounded-full transition-colors duration-500 ${i <= current ? "bg-accent" : "bg-default"}`} />
          <span className={`text-sm ${i === current ? "font-semibold text-foreground" : "text-muted"}`}>
            {t.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CodeQr({ code }: { code: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import("qrcode").then(({ default: QRCode }) =>
      QRCode.toDataURL(code, { width: 224, margin: 1 }).then((url) => {
        if (live) setSrc(url);
      }),
    );
    return () => {
      live = false;
    };
  }, [code]);
  return src ? (
    <img src={src} alt={`QR code for request ${code}`} width={224} height={224} className="rounded-xl bg-white p-2" />
  ) : (
    <div className="h-56 w-56 rounded-xl bg-default" aria-hidden />
  );
}

const ICON_STYLE: Record<StatusIconKind, string> = {
  check: "bg-success-soft text-success",
  alert: "bg-danger-soft text-danger",
  clock: "bg-warning-soft text-warning",
  dash: "bg-default text-muted",
};

const ICON_PATH: Record<StatusIconKind, string> = {
  check: "M5 13l4 4L19 7",
  alert: "M12 7v6M12 17h.01",
  clock: "M12 7v5l3 2",
  dash: "M7 12h10",
};

function StatusIcon({ kind }: { kind: StatusIconKind }) {
  return (
    <div className={`flex h-16 w-16 items-center justify-center rounded-full ${ICON_STYLE[kind]}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        className="h-8 w-8"
        aria-hidden
      >
        <path d={ICON_PATH[kind]} />
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
  expiresAt,
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
    <div className="min-h-dvh bg-transparent sm:px-4 sm:py-6">
      <div className="motion-list mx-auto flex w-full max-w-lg flex-col items-center gap-4 p-6 text-center sm:rounded-3xl sm:bg-surface sm:p-8 sm:shadow-surface">
        <LifecycleTrack status={status} />
        <StatusIcon kind={copy.icon} />

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground">{copy.title}</h1>
          {copy.body && <p className="text-sm text-muted">{copy.body}</p>}
          {status === "approved" && (
            <p className="mt-1 text-sm font-medium text-foreground">
              {PICKUP_INFO ?? PICKUP_FALLBACK}
              {expiresAt ? ` Collect by ${formatWhen(expiresAt)}.` : ""}
            </p>
          )}
          {status === "expired" && expiresAt && (
            <p className="mt-1 text-sm text-muted">It expired on {formatWhen(expiresAt)}.</p>
          )}
        </div>

        {status === "rejected" && rejectReason && (
          <div className="w-full rounded-xl bg-danger-soft p-4 text-left text-danger-soft-foreground">
            <p className="text-sm font-semibold">Reviewer's note</p>
            <p className="mt-1 text-sm">{rejectReason}</p>
          </div>
        )}

        {projectName && (
          <p className="text-sm text-muted">
            For project <span className="font-medium text-foreground">{projectName}</span>
          </p>
        )}

        {code && status === "approved" ? (
          <div className="motion-pass w-full px-2 pb-3">
            <div className="slip flex flex-col items-center gap-3 px-5 pb-6 pt-5 text-foreground">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest">
                Pickup slip · Show this when collecting
              </p>
              <hr className="slip-rule w-full" />
              <CodeQr code={code} />
              <hr className="slip-rule w-full" />
              <p className="font-mono text-3xl font-bold tracking-widest">{code}</p>
              <button
                type="button"
                onClick={copyCode}
                className="min-h-11 rounded-full bg-foreground px-5 text-sm font-medium text-white"
              >
                Copy code
              </button>
            </div>
          </div>
        ) : (
          code && (
            <div className="flex w-full items-center justify-between rounded-xl bg-background p-3 text-left">
              <div>
                <p className="text-sm text-muted">Request code</p>
                <p className="font-mono text-lg font-semibold tracking-wider text-foreground">{code}</p>
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="min-h-11 rounded-full bg-surface px-4 text-sm font-medium text-accent shadow-surface"
              >
                Copy
              </button>
            </div>
          )
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
              Edit and resubmit
            </Button>
          )}

          {isOwner && (status === "cancelled" || status === "expired") && (
            <Button onClick={() => navigate("/")} fullWidth className="rounded-full">
              Start a new request
            </Button>
          )}

          {publicToken && (
            <Button
              variant={status === "rejected" || status === "cancelled" || status === "expired" ? "ghost" : "secondary"}
              onClick={copyLink}
              fullWidth
              className="rounded-full"
            >
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
          description="Your components will be released. You'll need to submit a new request if you change your mind."
          confirmLabel="Yes, cancel request"
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
