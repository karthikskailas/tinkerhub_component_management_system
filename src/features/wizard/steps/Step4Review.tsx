import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { parseSupabaseError } from "../../../lib/errors";
import { supabase } from "../../../lib/supabase";
import { useFocusHeading } from "../../../lib/useFocusHeading";
import { useOnlineStatus } from "../../../lib/useOnlineStatus";
import { useCatalog } from "../../catalog/useCatalog";
import { submitRequest } from "../../requests/api";
import type { WizardDraft } from "../types";

interface Step4Props {
  draft: WizardDraft;
  onBack: () => void;
  onEditStep: (step: 1 | 2 | 3) => void;
  onSubmitted: (requestId: string, token: string) => void;
}

export function Step4Review({ draft, onBack, onEditStep, onSubmitted }: Step4Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const isOnline = useOnlineStatus();
  const headingRef = useFocusHeading();

  useEffect(() => {
    if (!draft.screenshotPath) return;
    let active = true;
    supabase.storage
      .from("screenshots")
      .createSignedUrl(draft.screenshotPath, 120)
      .then(({ data }) => {
        if (active && data) setSignedUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [draft.screenshotPath]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!draft.screenshotPath) throw new Error("Missing screenshot");
      return submitRequest({
        projectId: draft.path === "registered" ? draft.selectedProjectId : null,
        newProject:
          draft.path === "new" && draft.newProject
            ? {
                name: draft.newProject.name,
                description: draft.newProject.description,
                owner_name: draft.newProject.ownerName,
              }
            : null,
        requesterName: draft.requesterName,
        phone: draft.phone,
        screenshotPath: draft.screenshotPath,
        items: Object.values(draft.cart).map((line) => ({
          component_id: line.id,
          qty: line.qty,
        })),
      });
    },
    onSuccess: (row) => {
      onSubmitted(row.id, row.public_token);
    },
  });

  const cartLines = Object.values(draft.cart);
  const catalog = useCatalog();
  const detailsById = new Map((catalog.data ?? []).map((c) => [c.id, c]));

  return (
    <div className="motion-list flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h1 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-foreground focus:outline-none">
          Check your request
        </h1>
        <p className="text-sm text-muted">Tap Edit on anything that needs a change.</p>
      </div>

      {/* One card, one screen: the first three rows are fixed height and only
          the component list (which can be long) scrolls inside the card. */}
      <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-surface">
        <Row icon={ICON.user} title="Your details" onEdit={() => onEditStep(2)}>
          <p className="truncate text-base font-semibold text-foreground">{draft.requesterName}</p>
          <p className="font-mono text-sm text-muted">{draft.phone}</p>
        </Row>

        <Row icon={ICON.project} title="Project" onEdit={() => onEditStep(2)}>
          <p className="truncate text-base font-semibold text-foreground">
            {draft.path === "registered" ? draft.selectedProjectName : draft.newProject?.name}
          </p>
          {draft.path !== "registered" && draft.newProject?.description && (
            <p className="line-clamp-1 text-sm text-muted">{draft.newProject.description}</p>
          )}
        </Row>

        <Row icon={ICON.image} title="Screenshot" onEdit={() => onEditStep(2)}>
          <div className="flex items-center gap-2">
            {signedUrl ? (
              <img
                src={signedUrl}
                alt="Screenshot of your project page"
                width={32}
                height={32}
                loading="lazy"
                className="h-8 w-8 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div role="status" aria-label="Loading preview" className="h-8 w-8 shrink-0 overflow-hidden rounded-md">
                <Skeleton />
              </div>
            )}
            <p className="text-base font-semibold text-foreground">Attached</p>
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open screenshot in a new tab"
                className="flex h-11 w-11 shrink-0 items-center justify-center text-muted"
              >
                <Svg d={ICON.external} className="h-4 w-4" />
              </a>
            )}
          </div>
        </Row>

        <section className="flex min-h-24 flex-1 flex-col">
          <div className="flex items-center gap-3 px-3 pt-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Svg d={ICON.parts} className="h-4 w-4" />
            </span>
            <h2 className="flex-1 text-sm font-semibold text-foreground">
              Components <span className="text-muted">({cartLines.length})</span>
            </h2>
            <EditButton label="components" onClick={() => onEditStep(3)} />
          </div>
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-3 pb-3 pt-1">
            {cartLines.map((line) => {
              const info = detailsById.get(line.id);
              return (
                <li key={line.id} className="flex items-center gap-3">
                  <ReviewPhoto url={info?.imageUrl ?? null} />
                  <span className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                    {line.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-default px-2.5 py-0.5 font-mono text-sm font-semibold text-foreground">
                    × {line.qty}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <p className="flex items-start gap-2 text-sm text-muted">
        <span className="mt-0.5 text-accent"><Svg d={ICON.shield} className="h-4 w-4 shrink-0" /></span>
        Goes to the inventory manager for review. The next page updates by itself.
      </p>

      {mutation.isError && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger-soft-foreground">
          Your request wasn't sent. {parseSupabaseError(mutation.error).message} Your details are
          saved, so you can try again.
        </p>
      )}

      <div className="flex shrink-0 gap-3">
        <Button variant="secondary" onClick={onBack} disabled={mutation.isPending} className="shrink-0 rounded-full">
          Back
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!isOnline}
          className="flex-1 rounded-full"
        >
          {isOnline ? "Submit for review →" : "Reconnect to submit"}
        </Button>
      </div>
    </div>
  );
}

const ICON = {
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0",
  project: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5",
  image: "M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM4 17l5-5 4 4 3-3 4 4",
  parts: "M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4M8 7h8a1 1 0 011 1v8a1 1 0 01-1 1H8a1 1 0 01-1-1V8a1 1 0 011-1z",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9 12l2 2 4-4",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5",
};

function Svg({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

// A missing or broken photo link shows a neutral chip tile.
function ReviewPhoto({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-default text-muted"
      >
        <Svg d={ICON.parts} className="h-5 w-5" />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-lg bg-default object-contain"
    />
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Edit ${label}`}
      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-accent"
    >
      <Svg d={ICON.edit} className="h-4 w-4" />
      Edit
    </button>
  );
}

// A fixed-height summary row: icon and value on the left, Edit on the right.
function Row({
  icon,
  title,
  onEdit,
  children,
}: {
  icon: string;
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex shrink-0 items-center gap-3 px-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Svg d={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{title}</h2>
        {children}
      </div>
      <EditButton label={title.toLowerCase()} onClick={onEdit} />
    </section>
  );
}
