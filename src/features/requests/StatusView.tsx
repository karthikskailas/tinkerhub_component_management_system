import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/Toast";
import { useCatalog } from "../catalog/useCatalog";
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
    title: "Approved — ready for pickup",
    body: "",
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
    <ol className="flex w-full items-start" aria-label="Request progress">
      {TRACK.map((t, i) => {
        const done = i <= current;
        return (
          <li
            key={t.status}
            aria-current={i === current ? "step" : undefined}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <span className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : i <= current ? "bg-accent" : "bg-border"}`} />
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                  done ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface"
                }`}
              >
                {done ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"
                    strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-border" />
                )}
              </span>
              <span className={`h-0.5 flex-1 ${i === TRACK.length - 1 ? "bg-transparent" : i < current ? "bg-accent" : "bg-border"}`} />
            </span>
            <span className={`text-sm ${i === current ? "font-semibold text-accent" : "text-muted"}`}>
              {t.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CodeQr({ code, size = 176 }: { code: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import("qrcode").then(({ default: QRCode }) =>
      QRCode.toDataURL(code, { width: size * 2, margin: 1 }).then((url) => {
        if (live) setSrc(url);
      }),
    );
    return () => {
      live = false;
    };
  }, [code, size]);
  return src ? (
    <img src={src} alt={`QR code for request ${code}`} width={size} height={size} className="shrink-0 rounded-xl bg-white p-1" />
  ) : (
    <div style={{ width: size, height: size }} className="rounded-xl bg-default" aria-hidden />
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
    <div className={`relative flex h-20 w-20 items-center justify-center rounded-full ${ICON_STYLE[kind]}`}>
      {kind === "check" &&
        [0, 60, 120, 180, 240, 300].map((deg) => (
          <span
            key={deg}
            aria-hidden
            className="absolute left-1/2 top-1/2 h-0.5 w-2 rounded-full bg-success/40"
            style={{ transform: `rotate(${deg}deg) translateX(3.1rem) translate(-50%, -50%)` }}
          />
        ))}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        className="h-10 w-10"
        aria-hidden
      >
        <path d={ICON_PATH[kind]} />
      </svg>
    </div>
  );
}

const PATH = {
  copy: "M9 9h10a1 1 0 011 1v10a1 1 0 01-1 1H9a1 1 0 01-1-1V10a1 1 0 011-1zM16 5H6a1 1 0 00-1 1v10",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  calendar: "M7 3v4M17 3v4M4 9h16M6 5h12a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2zM12 13v3l2 1",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  chip: "M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4M8 7h8a1 1 0 011 1v8a1 1 0 01-1 1H8a1 1 0 01-1-1V8a1 1 0 011-1z",
};

function SvgIcon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

// Optional part photo; a neutral chip tile when there is none or it fails to load.
function ItemPhoto({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-default text-muted">
        <SvgIcon d={PATH.chip} className="h-6 w-6" />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-lg bg-default object-contain"
    />
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
  const [showAll, setShowAll] = useState(false);
  // On the pickup screen the code is the point; the parts list stays folded until asked for.
  const collapsedCount = status === "approved" ? 0 : 3;
  const copy = STATUS_COPY[status];
  const catalog = useCatalog();
  const imageByName = new Map(
    (catalog.data ?? []).filter((c) => c.imageUrl).map((c) => [c.name, c.imageUrl as string]),
  );

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
      <div className="motion-list mx-auto flex w-full max-w-lg flex-col items-center gap-3 p-4 text-center sm:rounded-3xl sm:bg-surface sm:p-8 sm:shadow-surface">
        <p className="self-start text-base font-bold tracking-tight text-foreground">
          TinkerSpace <span className="text-accent">Maker Cart</span>
        </p>
        <LifecycleTrack status={status} />
        {status !== "approved" && <StatusIcon kind={copy.icon} />}

        <div className="flex flex-col gap-1">
          <h1 className={`${status === "approved" ? "text-xl" : "text-2xl"} font-bold text-foreground`}>{copy.title}</h1>
          {copy.body && <p className="text-sm text-muted">{copy.body}</p>}
          {status === "approved" && (
            <div className="mt-2 flex w-full items-center gap-3 rounded-xl bg-accent/10 p-2.5 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <SvgIcon d={PATH.calendar} />
              </span>
              <div className="flex min-w-0 flex-col">
                {expiresAt && (
                  <p className="text-base font-bold text-foreground">Collect by {formatWhen(expiresAt)}</p>
                )}
                <p className="text-sm text-muted">{PICKUP_INFO ?? PICKUP_FALLBACK}</p>
              </div>
            </div>
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

        {projectName && status !== "approved" && (
          <p className="text-sm text-muted">
            For project <span className="font-medium text-foreground">{projectName}</span>
          </p>
        )}

        {code && status === "approved" ? (
          <div className="motion-pass w-full">
            <div className="flex w-full items-center gap-4 rounded-xl bg-surface p-3 text-left shadow-surface">
              <CodeQr code={code} size={144} />
              <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wider text-muted">Pickup code</p>
                  <p className="font-mono text-2xl font-bold tracking-wide text-foreground">{code}</p>
                </div>
                <button
                  type="button"
                  onClick={copyCode}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent/10 px-4 text-sm font-semibold text-accent"
                >
                  <SvgIcon d={PATH.copy} className="h-4 w-4" />
                  Copy code
                </button>
                <p className="text-sm text-muted">Turn brightness up if it won't scan.</p>
              </div>
            </div>
          </div>
        ) : (
          code && (
            <div className="flex w-full items-center justify-between gap-3 rounded-xl bg-accent/10 p-4 text-left">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-muted">Request code</p>
                <p className="font-mono text-3xl font-bold tracking-wider text-foreground">{code}</p>
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-accent/30 bg-surface px-4 text-sm font-semibold text-accent"
              >
                <SvgIcon d={PATH.copy} className="h-4 w-4" />
                Copy
              </button>
            </div>
          )
        )}

        <div className="w-full rounded-xl bg-surface px-4 py-1 text-left shadow-surface">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">Components ({items.length})</h2>
            {collapsedCount === 0 && items.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-accent"
              >
                {showAll ? "Hide list" : "Show list"}
              </button>
            )}
          </div>
          <ul className="flex flex-col">
            {(showAll ? items : items.slice(0, collapsedCount)).map((item) => {
              const photo = imageByName.get(item.name) ?? null;
              return (
                <li
                  key={item.name}
                  className="flex items-center gap-3 border-b border-border py-2 last:border-b-0 last:pb-0"
                >
                  <ItemPhoto url={photo} />
                  <span className="min-w-0 flex-1 truncate text-base text-foreground">{item.name}</span>
                  <span className="shrink-0 font-mono text-base text-foreground">
                    {item.approvedQty !== null && item.approvedQty !== item.qty ? (
                      <>
                        <span className="text-muted line-through">{item.qty}</span> {item.approvedQty}
                      </>
                    ) : (
                      item.qty
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {collapsedCount > 0 && items.length > collapsedCount && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-accent"
            >
              {showAll ? "Hide list" : `Show all ${items.length}`}
            </button>
          )}
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
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-accent/40 bg-surface px-5 text-base font-semibold text-accent"
            >
              <SvgIcon d={PATH.link} />
              Copy status link
            </button>
          )}

          {isOwner && status === "pending" && onCancel && (
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-danger/40 bg-danger-soft px-5 text-base font-semibold text-danger"
            >
              <SvgIcon d={PATH.trash} />
              Cancel request
            </button>
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
