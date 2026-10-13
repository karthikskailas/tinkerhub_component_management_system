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
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Review &amp; submit</h1>

      <Section title="Your details" onEdit={() => onEditStep(2)}>
        <p className="text-sm text-slate-700">{draft.requesterName}</p>
        <p className="text-sm text-slate-700">{draft.phone}</p>
      </Section>

      <Section title="Project" onEdit={() => onEditStep(1)}>
        {draft.path === "registered" ? (
          <p className="text-sm text-slate-700">{draft.selectedProjectName}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-800">{draft.newProject?.name}</p>
            <p className="text-sm text-slate-600">{draft.newProject?.description}</p>
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
            className="h-24 w-24 rounded-md object-cover"
          />
        ) : (
          <p className="text-sm text-slate-500">Loading preview...</p>
        )}
      </Section>

      <Section title={`Components (${cartLines.length})`} onEdit={() => onEditStep(3)}>
        <ul className="space-y-1">
          {cartLines.map((line) => (
            <li key={line.id} className="flex justify-between text-sm text-slate-700">
              <span>{line.name}</span>
              <span className="font-medium">× {line.qty}</span>
            </li>
          ))}
        </ul>
      </Section>

      <div className="mt-6 flex justify-between">
        <Button variant="secondary" onClick={onBack} disabled={mutation.isPending}>
          Back
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!isOnline}
        >
          {isOnline ? "Submit for review" : "Offline"}
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
    <div className="mb-4 rounded-lg border border-slate-200 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <button type="button" onClick={onEdit} className="text-xs font-medium text-indigo-600">
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}
