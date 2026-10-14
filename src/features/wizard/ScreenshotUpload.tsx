import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { compressToWebp, validateImageFile, ImageValidationError } from "../../lib/image";
import { supabase } from "../../lib/supabase";

interface ScreenshotUploadProps {
  userId: string;
  path: string | null;
  onChange: (path: string | null) => void;
  label?: string;
  labelExtra?: ReactNode;
  helperText?: string;
  error?: string;
}

export function ScreenshotUpload({
  userId,
  path,
  onChange,
  label = "Payment / registration screenshot",
  labelExtra,
  helperText,
  error,
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
        .from("screenshots")
        .upload(objectPath, compressed, { contentType: "image/webp" });
      if (error) throw error;

      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(compressed);
      });
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
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {labelExtra}
      </div>
      {helperText && <p className="text-sm text-muted">{helperText}</p>}

      {path && (
        <div className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-surface">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Screenshot preview"
              width={64}
              height={64}
              loading="lazy"
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-default text-sm text-muted">
              Saved
            </div>
          )}
          <div className="flex-1 text-sm text-muted">Screenshot attached</div>
          <button
            type="button"
            onClick={remove}
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm font-medium text-danger hover:underline"
          >
            Remove
          </button>
        </div>
      )}

      {!path && (
        <label className="flex min-h-24 cursor-pointer focus-within:ring-2 focus-within:ring-accent items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface px-4 py-6 text-center shadow-surface">
          {uploading ? (
            <span role="status" className="text-sm text-muted">Uploading screenshot...</span>
          ) : (
            <span className="text-sm font-medium text-accent">
              Tap to choose a screenshot
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
            </span>
          )}
        </label>
      )}
      {(uploadError ?? error) && !path && (
        <p role="alert" className="text-sm text-danger">
          {uploadError ?? error}
        </p>
      )}
    </div>
  );
}
