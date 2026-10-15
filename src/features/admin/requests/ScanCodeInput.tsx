import { useEffect, useRef, useState } from "react";
import { toast } from "../../../components/ui/Toast";
import { findRequestIdByScan } from "./api";

interface ScanCodeInputProps {
  onFound: (requestId: string) => void;
}

// Native BarcodeDetector where it exists (Android Chrome); jsQR decodes video
// frames everywhere else (desktop Chrome, Firefox, Safari).

function CameraScan({ onText, onClose }: { onText: (t: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let live = true;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!live || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const video = videoRef.current;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Native = (window as any).BarcodeDetector;
        const detector = Native ? new Native({ formats: ["qr_code"] }) : null;
        const jsQR = detector ? null : (await import("jsqr")).default;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        while (live) {
          let text: string | undefined;
          if (detector) {
            text = (await detector.detect(video))[0]?.rawValue;
          } else if (jsQR && ctx && video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height)?.data;
          }
          if (text) {
            onText(text);
            return;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        toast.error("Couldn't use the camera. Type or paste the code instead.");
        onClose();
      }
    })();
    return () => {
      live = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onText, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-4">
      <video ref={videoRef} playsInline muted className="max-h-[70vh] w-full max-w-md rounded-2xl bg-black" />
      <button
        type="button"
        onClick={onClose}
        className="min-h-11 rounded-full bg-surface px-6 text-base font-semibold text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}

// Accepts the borrower's QR (scanned with the camera, a hardware scanner, or
// pasted) or the 8-char request code, and jumps straight to that request.
export function ScanCodeInput({ onFound }: ScanCodeInputProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  async function resolve(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const requestId = await findRequestIdByScan(trimmed);
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
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void resolve(code);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          inputMode="text"
          placeholder="Scan or enter code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="min-h-11 w-40 rounded-lg border border-border bg-background px-3 text-sm text-field-foreground outline-none focus:border-accent sm:w-56"
        />
        <button
          type="button"
          onClick={() => setScanning(true)}
          className="min-h-11 rounded-lg bg-default px-3 text-sm font-medium text-foreground"
        >
          Scan QR
        </button>
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          Go
        </button>
      </form>
      {scanning && (
        <CameraScan
          onClose={() => setScanning(false)}
          onText={(t) => {
            setScanning(false);
            void resolve(t);
          }}
        />
      )}
    </>
  );
}
