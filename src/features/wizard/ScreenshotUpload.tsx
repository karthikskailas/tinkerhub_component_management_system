import { useRef, useState } from "react";
import { compressToWebp, validateImageFile, ImageValidationError } from "../../lib/image";
import { supabase } from "../../lib/supabase";

interface ScreenshotUploadProps {
  userId: string;
  path: string | null;
  onChange: (path: string | null) => void;
  error?: string;
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

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ScreenshotUpload({ userId, path, onChange, error }: ScreenshotUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ name: string; size: number } | null>(null);
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
        .from("screenshots")
        .upload(objectPath, compressed, { contentType: "image/webp" });
      if (error) throw error;

      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(compressed);
      });
      setMeta({ name: file.name, size: file.size });
      onChange(objectPath);
    } catch {
      setUploadError("The screenshot didn't upload. Check your connection and choose it again.");
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setMeta(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const shownError = !path ? (uploadError ?? error) : null;

  return (
    <div className="flex flex-col gap-4">
      <label
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed bg-accent/5 px-4 py-8 text-center focus-within:ring-2 focus-within:ring-accent ${
          shownError ? "border-danger" : "border-accent/40"
        }`}
      >
        {uploading ? (
          <span role="status" className="text-sm text-muted">Uploading screenshot...</span>
        ) : (
          <>
            <ImageIcon className="h-9 w-9 text-accent" />
            <span className="flex flex-col gap-0.5">
              <span className="text-base font-semibold text-foreground">
                {path ? "Replace screenshot" : "Upload screenshot"}
              </span>
              <span className="text-sm text-muted">Any image, up to 10 MB</span>
            </span>
            <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-5 text-sm font-semibold text-accent shadow-surface">
              <ImageIcon className="h-4 w-4" />
              Choose from gallery
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
          className="sr-only"
        />
      </label>

      {shownError && (
        <p role="alert" className="text-sm text-danger">{shownError}</p>
      )}

      {path && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-foreground">Attached screenshot</span>
          <div className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-surface">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Screenshot preview"
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-default text-muted">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-base font-semibold text-foreground">Screenshot attached</span>
              <span className="truncate text-sm text-muted">
                {meta ? `${meta.name} · ${formatSize(meta.size)}` : "Saved"}
              </span>
            </div>
            <button
              type="button"
              onClick={remove}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm font-medium text-danger hover:underline"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
