import { useRef, useState } from "react";
import { compressToWebp, validateImageFile, ImageValidationError } from "../../lib/image";
import { supabase } from "../../lib/supabase";

interface ScreenshotUploadProps {
  userId: string;
  path: string | null;
  onChange: (path: string | null) => void;
  error?: string;
  /** Defaults to the request-screenshot bucket and copy; the return flow overrides them. */
  bucket?: string;
  noun?: string;
  capture?: boolean;
  /** One short row instead of the large dashed drop area (fits a no-scroll screen). */
  compact?: boolean;
}

function ImageIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M4 18l5-5 4 4 3-3 4 4" />
    </svg>
  );
}

export function ScreenshotUpload({
  userId,
  path,
  onChange,
  error,
  bucket = "screenshots",
  noun = "screenshot",
  capture = false,
  compact = false,
}: ScreenshotUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploadError(null);
    try {
      validateImageFile(file);
    } catch (err) {
      setUploadError(err instanceof ImageValidationError ? err.message : "That file isn't a usable image.");
      return;
    }

    setUploading(true);
    try {
      const compressed = await compressToWebp(file);
      const objectPath = `${userId}/${crypto.randomUUID()}.webp`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(objectPath, compressed, { contentType: "image/webp" });
      if (error) throw error;

      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(compressed);
      });
      onChange(objectPath);
    } catch {
      setUploadError(`The ${noun} didn't upload. Check your connection and choose it again.`);
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const shownError = !path ? (uploadError ?? error) : null;
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture={capture ? "environment" : undefined}
      disabled={uploading}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void handleFile(file);
        e.target.value = "";
      }}
      className="sr-only"
    />
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        {path ? (
          <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-accent/40 bg-accent/5 p-2">
            {previewUrl ? (
              <img src={previewUrl} alt={`${noun[0].toUpperCase()}${noun.slice(1)} preview`} className="h-12 w-12 shrink-0 rounded-lg bg-default object-cover" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-default text-muted">
                <ImageIcon className="h-6 w-6" />
              </span>
            )}
            <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
              {uploading ? `Uploading ${noun}...` : `${noun[0].toUpperCase()}${noun.slice(1)} added`}
            </span>
            {!uploading && (
              <>
                <label className="inline-flex min-h-11 cursor-pointer items-center px-2 text-sm font-semibold text-accent focus-within:ring-2 focus-within:ring-accent">
                  Replace
                  {input}
                </label>
                <button type="button" onClick={remove} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-danger">
                  Remove
                </button>
              </>
            )}
          </div>
        ) : (
          <label
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed bg-accent/5 px-3 focus-within:ring-2 focus-within:ring-accent ${
              shownError ? "border-danger" : "border-accent/40"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-accent shadow-surface">
              <ImageIcon className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-base font-semibold text-foreground">
                {uploading ? `Uploading ${noun}...` : `Add ${noun}`}
              </span>
              <span className="text-sm text-muted">Camera or gallery, up to 10 MB</span>
            </span>
            {input}
          </label>
        )}
        {shownError && <p role="alert" className="text-sm text-danger">{shownError}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {path ? (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 p-3">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`${noun[0].toUpperCase()}${noun.slice(1)} preview`}
              className="max-h-72 w-full rounded-xl bg-default object-contain"
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center rounded-xl bg-default text-muted">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
          {uploading ? (
            <span role="status" className="text-center text-sm text-muted">Uploading {noun}...</span>
          ) : (
            <div className="flex gap-3">
              <label className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-surface px-5 text-sm font-semibold text-accent shadow-surface focus-within:ring-2 focus-within:ring-accent">
                <ImageIcon className="h-4 w-4" />
                Replace
                {input}
              </label>
              <button
                type="button"
                onClick={remove}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-surface px-5 text-sm font-semibold text-danger shadow-surface"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ) : (
        <label
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed bg-accent/5 px-4 py-8 text-center focus-within:ring-2 focus-within:ring-accent ${
            shownError ? "border-danger" : "border-accent/40"
          }`}
        >
          {uploading ? (
            <span role="status" className="text-sm text-muted">Uploading {noun}...</span>
          ) : (
            <>
              <ImageIcon className="h-9 w-9 text-accent" />
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-semibold text-foreground">Upload {noun}</span>
                <span className="text-sm text-muted">Any image, up to 10 MB</span>
              </span>
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-5 text-sm font-semibold text-accent shadow-surface">
                <ImageIcon className="h-4 w-4" />
                Choose from gallery
              </span>
            </>
          )}
          {input}
        </label>
      )}

      {shownError && (
        <p role="alert" className="text-sm text-danger">{shownError}</p>
      )}
    </div>
  );
}
