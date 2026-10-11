import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "../../components/ui/Toast";
import { compressToWebp, validateImageFile, ImageValidationError } from "../../lib/image";
import { supabase } from "../../lib/supabase";

interface ScreenshotUploadProps {
  userId: string;
  path: string | null;
  onChange: (path: string | null) => void;
  label?: string;
  labelExtra?: ReactNode;
  helperText?: string;
}

export function ScreenshotUpload({
  userId,
  path,
  onChange,
  label = "Payment / registration screenshot",
  labelExtra,
  helperText,
}: ScreenshotUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    try {
      validateImageFile(file);
    } catch (err) {
      toast.error(err instanceof ImageValidationError ? err.message : "Invalid image.");
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
      toast.error("Couldn't upload the screenshot. Please try again.");
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
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {labelExtra}
      </div>
      {helperText && <p className="mb-2 text-xs text-slate-500">{helperText}</p>}

      {path && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-slate-200 p-2">
          {previewUrl ? (
            <img src={previewUrl} alt="Screenshot preview" className="h-16 w-16 rounded-md object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-500">
              Saved
            </div>
          )}
          <div className="flex-1 text-sm text-slate-600">Screenshot attached</div>
          <button
            type="button"
            onClick={remove}
            className="min-h-11 rounded-md px-3 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Remove
          </button>
        </div>
      )}

      {!path && (
        <label className="flex min-h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 hover:border-indigo-400">
          {uploading ? (
            "Uploading..."
          ) : (
            <span>
              Tap to choose a screenshot
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </span>
          )}
        </label>
      )}
    </div>
  );
}
