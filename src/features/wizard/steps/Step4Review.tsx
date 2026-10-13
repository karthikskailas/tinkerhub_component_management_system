import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../components/ui/Toast";
import { parseSupabaseError } from "../../../lib/errors";
import { supabase } from "../../../lib/supabase";
import { useOnlineStatus } from "../../../lib/useOnlineStatus";
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
    onError: (error) => {
      toast.error(parseSupabaseError(error).message);
    },
  });

  const cartLines = Object.values(draft.cart);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Review &amp; submit</h1>

      <Section title="Your details" onEdit={() => onEditStep(2)}>
        <p className="text-sm text-foreground">{draft.requesterName}</p>
        <p className="text-sm text-muted">{draft.phone}</p>
      </Section>

      <Section title="Project" onEdit={() => onEditStep(1)}>
        {draft.path === "registered" ? (
          <p className="text-sm text-foreground">{draft.selectedProjectName}</p>
        ) : (
          <>
            <p className="text-sm text-foreground">{draft.newProject?.name}</p>
            <p className="text-sm text-muted">{draft.newProject?.description}</p>
          </>
        )}
      </Section>

      <Section title="Screenshot" onEdit={() => onEditStep(2)}>
        {signedUrl ? (
          <img
            src={signedUrl}
            alt="Screenshot"
            width={96}
            height={96}
            loading="lazy"
            className="h-24 w-24 rounded-lg object-cover"
          />
        ) : (
          <p className="text-sm text-muted">Loading preview...</p>
        )}
      </Section>

      <Section title={`Components (${cartLines.length})`} onEdit={() => onEditStep(3)}>
        <ul className="flex flex-col gap-1">
          {cartLines.map((line) => (
            <li key={line.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{line.name}</span>
              <span className="text-muted">× {line.qty}</span>
            </li>
          ))}
        </ul>
      </Section>

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
          {isOnline ? "Submit for review →" : "Offline"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-surface p-4 shadow-surface">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <button type="button" onClick={onEdit} className="text-xs font-medium text-accent hover:underline">
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}
