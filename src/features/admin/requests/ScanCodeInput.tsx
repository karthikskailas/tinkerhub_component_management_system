import { useState } from "react";
import { toast } from "../../../components/ui/Toast";
import { findRequestIdByCode } from "./api";

interface ScanCodeInputProps {
  onFound: (requestId: string) => void;
}

// Accepts a scanned or typed request code (the 8-char code shown on the
// pickup card / status page) and jumps straight to that request. Camera
// scanning itself is out of scope — this is just the destination for
// whatever text a barcode/QR scanner app types into focus, or a manual
// entry.
export function ScanCodeInput({ onFound }: ScanCodeInputProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const requestId = await findRequestIdByCode(trimmed);
      if (requestId) {
        setCode("");
        onFound(requestId);
      } else {
        toast.error("No request found for that code.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        inputMode="text"
        placeholder="Scan or enter code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="min-h-11 w-40 rounded-lg border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="submit"
        disabled={busy || !code.trim()}
        className="min-h-11 rounded-lg bg-slate-100 px-3 text-sm font-medium text-slate-700 disabled:opacity-50"
      >
        Go
      </button>
    </form>
  );
}
