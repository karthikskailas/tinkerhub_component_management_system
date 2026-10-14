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
  onSubmitted: (requestId: string) => void;
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
      onSubmitted(row.id);
    },
  });

  const cartLines = Object.values(draft.cart);
  const catalog = useCatalog();
  const detailsById = new Map((catalog.data ?? []).map((c) => [c.id, c]));

  return (
    <div className="motion-list flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-foreground focus:outline-none">Check your request</h1>
        <p className="text-sm text-muted">
          Please review your details before submitting. You can edit any section if needed.
        </p>
      </div>

      <Section icon={ICON.user} title="Your details" onEdit={() => onEditStep(2)}>
        <p className="text-base font-semibold text-foreground">{draft.requesterName}</p>
        <p className="font-mono text-base text-muted">{draft.phone}</p>
      </Section>

      <Section icon={ICON.project} title="Project" onEdit={() => onEditStep(1)}>
        {draft.path === "registered" ? (
          <p className="text-base font-semibold text-foreground">{draft.selectedProjectName}</p>
        ) : (
          <>
            <p className="text-base font-semibold text-foreground">{draft.newProject?.name}</p>
            <p className="text-base text-muted">{draft.newProject?.description}</p>
          </>
        )}
      </Section>

      <Section icon={ICON.image} title="Screenshot" onEdit={() => onEditStep(2)}>
        <div className="flex items-center gap-3">
          {signedUrl ? (
            <img
              src={signedUrl}
              alt="Screenshot of your project page"
              width={56}
              height={56}
              loading="lazy"
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div role="status" aria-label="Loading preview" className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
              <Skeleton />
            </div>
          )}
          <p className="flex-1 text-base font-semibold text-foreground">Screenshot attached</p>
          {signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open screenshot in a new tab"
              className="flex h-11 w-11 shrink-0 items-center justify-center text-muted"
            >
              <Svg d={ICON.external} />
            </a>
          )}
        </div>
      </Section>

      <Section icon={ICON.parts} title="Components" count={cartLines.length} onEdit={() => onEditStep(3)}>
        <ul className="flex flex-col gap-3">
          {cartLines.map((line) => {
            const info = detailsById.get(line.id);
            return (
              <li key={line.id} className="flex items-center gap-3">
                <ReviewPhoto url={info?.imageUrl ?? null} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-semibold text-foreground">{line.name}</span>
                  {info?.description && (
                    <span className="truncate text-sm text-muted">{info.description}</span>
                  )}
                </span>
                <span className="shrink-0 rounded-full bg-default px-3 py-1 font-mono text-sm font-semibold text-foreground">
                  × {line.qty}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="flex gap-3 rounded-xl bg-accent/10 p-4">
        <span className="mt-0.5 text-accent"><Svg d={ICON.shield} className="h-6 w-6 shrink-0" /></span>
        <p className="text-sm text-muted">
          Your request goes to the inventory manager for review. The next page updates by itself
          once it's decided.
        </p>
      </div>

      {mutation.isError && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger-soft-foreground">
          Your request wasn't sent. {parseSupabaseError(mutation.error).message} Your details are
          saved, so you can try again.
        </p>
      )}

      <div className="flex gap-3">
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
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-default text-muted"
      >
        <Svg d={ICON.parts} className="h-6 w-6" />
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

function Section({
  icon,
  title,
  count,
  onEdit,
  children,
}: {
  icon: string;
  title: string;
  count?: number;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-surface">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Svg d={icon} />
        </span>
        <h2 className="flex-1 text-base font-semibold text-foreground">
          {title}
          {count !== undefined && <span className="text-muted"> ({count})</span>}
        </h2>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${title.toLowerCase()}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent/10 px-4 text-sm font-semibold text-accent"
        >
          <Svg d={ICON.edit} className="h-4 w-4" />
          Edit
        </button>
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  );
}
