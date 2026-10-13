import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../components/ui/Toast";
import { buildWhatsAppUrl } from "../../../lib/whatsapp";
import type { PickupCardData } from "./api";

const CARD_WIDTH = 600;
const QR_SIZE = 120;

function buildSummaryText(data: PickupCardData): string {
  const lines = [
    `Component pickup — ${data.short_code}`,
    data.project_name ? `Project: ${data.project_name}` : null,
    "",
    ...data.items.map((item) => `- ${item.name} (${item.location ?? "—"}) x${item.approved_qty}`),
    "",
    data.expires_at ? `Valid until ${new Date(data.expires_at).toLocaleString()}` : null,
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

export function PickupCard({ data }: { data: PickupCardData }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const summaryText = buildSummaryText(data);

  useEffect(() => {
    let active = true;
    // Encodes only the request code — never the phone number or any other
    // personal data — so the QR is safe to hand over on a printed/shown card.
    import("qrcode").then(({ default: QRCode }) =>
      QRCode.toDataURL(data.short_code, { width: QR_SIZE, margin: 1 }).then((url) => {
        if (active) setQrDataUrl(url);
      }),
    );
    return () => {
      active = false;
    };
  }, [data.short_code]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current!, { pixelRatio: 2, width: CARD_WIDTH });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `pickup-${data.short_code}.png`;
      link.click();
    } catch {
      toast.error("Couldn't generate the image. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleShare() {
    setSharing(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(cardRef.current!, { pixelRatio: 2, width: CARD_WIDTH });

      if (blob) {
        const file = new File([blob], `pickup-${data.short_code}.png`, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: "Component pickup", text: summaryText });
            return;
          } catch {
            // user cancelled the share sheet, or it failed — fall through to wa.me
          }
        }
      }

      window.open(buildWhatsAppUrl(data.phone, summaryText), "_blank", "noopener");
    } catch {
      toast.error("Couldn't share. Try 'Copy text' instead.");
    } finally {
      setSharing(false);
    }
  }

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(summaryText);
      toast.success("Text copied.");
    } catch {
      toast.error("Couldn't copy the text.");
    }
  }

  return (
    <div>
      <div
        ref={cardRef}
        style={{ width: CARD_WIDTH }}
        className="mx-auto rounded-xl border border-slate-200 bg-white p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Component pickup</h2>
            <p className="mt-1 font-mono text-sm font-semibold text-indigo-600">{data.short_code}</p>
          </div>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for request ${data.short_code}`}
              width={QR_SIZE}
              height={QR_SIZE}
              className="shrink-0 rounded-md border border-slate-100"
            />
          ) : (
            <div
              style={{ width: QR_SIZE, height: QR_SIZE }}
              className="shrink-0 animate-pulse rounded-md bg-slate-100"
            />
          )}
        </div>

        <div className="mt-3 space-y-0.5 text-sm text-slate-700">
          <p className="font-medium">{data.requester_name}</p>
          <p>{data.phone}</p>
          {data.project_name && <p>{data.project_name}</p>}
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-1 font-medium">Component</th>
              <th className="py-1 font-medium">Location</th>
              <th className="py-1 text-right font-medium">Qty</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.name} className="border-b border-slate-100">
                <td className="py-1.5 text-slate-900">{item.name}</td>
                <td className="py-1.5 text-slate-600">{item.location ?? "—"}</td>
                <td className="py-1.5 text-right text-slate-900">{item.approved_qty}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.expires_at && (
          <p className="mt-4 text-xs text-amber-600">
            Valid until {new Date(data.expires_at).toLocaleString()}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button
          variant="secondary"
          loading={downloading}
          disabled={!qrDataUrl}
          onClick={handleDownload}
        >
          Download as PNG
        </Button>
        <Button loading={sharing} disabled={!qrDataUrl} onClick={handleShare}>
          Share via WhatsApp
        </Button>
        <Button variant="ghost" onClick={handleCopyText}>
          Copy text
        </Button>
      </div>
    </div>
  );
}
