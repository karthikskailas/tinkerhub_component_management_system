import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { toast } from "../../../components/ui/Toast";
import { parseSupabaseError } from "../../../lib/errors";
import { supabase } from "../../../lib/supabase";
import { resetReturnSubmission } from "./api";
import type { RequestDetail } from "./api";

// Signed for 120 s and never kept past the 100 s the spec allows: gcTime 0
// plus a 100 s staleTime means reopening a panel always signs a fresh URL.
function useReturnPhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ["return_photo_signed", path],
    enabled: !!path,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("return-photos").createSignedUrl(path!, 120);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 100_000,
    gcTime: 0,
    retry: false,
  });
}

export function ReturnProof({
  detail,
  canReset,
  onReset,
}: {
  detail: RequestDetail;
  /** Returns panel only; History is read-only. */
  canReset?: boolean;
  onReset?: () => void;
}) {
  const queryClient = useQueryClient();
  const photo = useReturnPhotoUrl(detail.return_photo_path);
  const [zoom, setZoom] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [reason, setReason] = useState("");

  const reset = useMutation({
    mutationFn: () => resetReturnSubmission(detail.id, reason.trim()),
    onSuccess: () => {
      toast.success("Student can submit again.");
      setResetting(false);
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["request_detail", detail.id] });
      void queryClient.invalidateQueries({ queryKey: ["returns_requests"] });
      onReset?.();
    },
    onError: (error) => toast.error(parseSupabaseError(error).message),
  });

  if (!detail.return_submitted_at) return null;
  const when = new Date(detail.return_submitted_at).toLocaleString();

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-success-soft p-4">
      <p className="text-sm font-semibold text-foreground">
        Student says: returned to {detail.return_receiver ?? "unknown"} on {when}
      </p>
      {detail.return_note && <p className="text-sm text-muted">Note: {detail.return_note}</p>}
      {photo.data ? (
        <button type="button" onClick={() => setZoom(true)} className="self-start" aria-label="Zoom return photo">
          <img src={photo.data} alt="Return photo" className="max-h-48 rounded-lg object-cover" />
        </button>
      ) : (
        <p className="text-sm text-muted">{photo.isError ? "Couldn't load the photo." : "Loading photo..."}</p>
      )}
      {canReset && (
        <Button variant="secondary" onClick={() => setResetting(true)}>
          Ask student to resubmit
        </Button>
      )}

      <Modal open={zoom} onClose={() => setZoom(false)} variant="bare">
        {photo.data && (
          <button type="button" onClick={() => setZoom(false)} className="block">
            <img src={photo.data} alt="Return photo, enlarged" className="max-h-[85dvh] max-w-full rounded-lg" />
          </button>
        )}
      </Modal>

      <Modal open={resetting} onClose={() => setResetting(false)} titleId="reset-return-title">
        <h2 id="reset-return-title" className="text-xl font-bold text-foreground">
          Ask student to resubmit
        </h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted">Reason (min 3 characters)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-11 rounded-lg border border-border bg-background px-3 text-base text-field-foreground"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResetting(false)} disabled={reset.isPending}>
            Cancel
          </Button>
          <Button loading={reset.isPending} disabled={reason.trim().length < 3} onClick={() => reset.mutate()}>
            Reset submission
          </Button>
        </div>
      </Modal>
    </section>
  );
}
