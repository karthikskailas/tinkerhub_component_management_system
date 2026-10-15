import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SwipeConfirm } from "../../components/ui/SwipeConfirm";
import { toast } from "../../components/ui/Toast";
import { parseSupabaseError } from "../../lib/errors";
import { supabase } from "../../lib/supabase";
import { useOnlineStatus } from "../../lib/useOnlineStatus";
import { useAuth } from "../auth/useAuth";
import { ScreenshotUpload } from "../wizard/ScreenshotUpload";
import { listHandoverStaff, submitReturn } from "./api";
import type { ReturnSubmission } from "./api";

interface ReturnCardProps {
  requestId: string;
  /** Set on /r/:token: submits by token so a lost session still works. */
  token: string | null;
  pending: boolean;
  submission: ReturnSubmission | null;
  invalidateKey: readonly unknown[];
}

const FIELD =
  "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-field-foreground";
const OTHER = "other";

function SubmittedCard({ submission }: { submission: ReturnSubmission }) {
  // Short-lived signed URL; only the owning session can sign it, so a
  // token-only visitor simply sees no thumbnail.
  const photo = useQuery({
    queryKey: ["return_photo", submission.photo_path],
    enabled: !!submission.photo_path,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("return-photos")
        .createSignedUrl(submission.photo_path!, 120);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  return (
    <div className="flex w-full items-center gap-3 rounded-xl bg-success-soft p-4 text-left">
      {photo.data && (
        <img src={photo.data} alt="Photo of the returned components" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
      )}
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">Return submitted</h2>
        <p className="text-sm text-muted">Waiting for the inventory manager to verify.</p>
        <p className="mt-1 text-sm text-foreground">
          Received by {submission.receiver} ·{" "}
          {new Date(submission.submitted_at).toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

export function ReturnCard({ requestId, token, pending, submission, invalidateKey }: ReturnCardProps) {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const [receiver, setReceiver] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherDesignation, setOtherDesignation] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const showForm = pending && !submission;
  const staff = useQuery({
    queryKey: ["handover_staff_public"],
    queryFn: listHandoverStaff,
    enabled: showForm,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      submitReturn(requestId, token, {
        photoPath: photoPath!,
        staffId: receiver === OTHER ? null : receiver,
        otherName,
        otherDesignation,
        note,
      }),
    onSuccess: () => {
      toast.success("Return submitted.");
      void queryClient.invalidateQueries({ queryKey: [...invalidateKey] });
    },
    onError: (error) => {
      const parsed = parseSupabaseError(error);
      if (parsed.code === "E_ALREADY_SUBMITTED" || parsed.code === "E_INVALID_STATUS") {
        toast.error(
          parsed.code === "E_ALREADY_SUBMITTED"
            ? "A return was already submitted for this request."
            : "This request isn't waiting for a return any more.",
        );
        void queryClient.invalidateQueries({ queryKey: [...invalidateKey] });
      } else {
        toast.error(parsed.message);
      }
    },
  });

  if (submission) return <SubmittedCard submission={submission} />;
  if (!showForm) return null;

  const receiverOk =
    receiver !== "" &&
    (receiver !== OTHER || (otherName.trim().length >= 2 && otherDesignation.trim().length >= 2));
  const ready = receiverOk && !!photoPath && online && !mutation.isPending;

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl bg-surface p-3 text-left shadow-surface">
      <div>
        <h2 className="text-base font-semibold text-foreground">Return components</h2>
        <p className="text-sm text-muted">
          Hand them to staff, take a photo, then swipe to confirm.{" "}
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            className="font-semibold text-accent"
          >
            {showHelp ? "Less" : "Details"}
          </button>
        </p>
        {showHelp && (
          <p className="mt-1 text-sm text-muted">
            Give the components to the inventory manager, space manager or lab staff. If nobody is
            available, give them to the security desk and note their name and designation. A photo
            of the components is required.
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Who received them?</span>
        <select value={receiver} onChange={(e) => setReceiver(e.target.value)} className={FIELD}>
          <option value="">Choose...</option>
          {(staff.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.designation ? `${s.name} · ${s.designation}` : s.name}
            </option>
          ))}
          <option value={OTHER}>Someone else</option>
        </select>
      </label>

      {receiver === OTHER && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Their name</span>
            <input value={otherName} maxLength={60} onChange={(e) => setOtherName(e.target.value)} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Their designation</span>
            <input
              value={otherDesignation}
              maxLength={60}
              placeholder="e.g. Security guard"
              onChange={(e) => setOtherDesignation(e.target.value)}
              className={FIELD}
            />
          </label>
        </div>
      )}

      {user ? (
        <ScreenshotUpload
          userId={user.id}
          path={photoPath}
          onChange={setPhotoPath}
          bucket="return-photos"
          noun="photo"
          capture
          compact
        />
      ) : (
        <p className="text-sm text-muted">Connecting...</p>
      )}

      {showNote || note ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Note (optional)</span>
          <textarea
            value={note}
            maxLength={300}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            className={`${FIELD} py-2`}
          />
        </label>
      ) : (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-accent"
        >
          + Add a note
        </button>
      )}

      <SwipeConfirm
        label="Swipe to confirm return"
        pendingLabel="Submitting…"
        disabled={!ready}
        onConfirm={() => mutation.mutateAsync().then(
          () => undefined,
          () => undefined,
        )}
      />
      {!online && <p className="text-sm text-muted">You're offline. Reconnect to submit.</p>}
    </div>
  );
}
