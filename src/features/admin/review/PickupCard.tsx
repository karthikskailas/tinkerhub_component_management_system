import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../components/ui/Toast";
import { buildWhatsAppUrl } from "../../../lib/whatsapp";
import { handoverUrl } from "../requests/api";
import { ShareHandoverButtons } from "../requests/ShareHandover";
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
    // Same URL as the borrower's own page: only the secret token, never the
    // phone number or any other personal data.
    import("qrcode").then(({ default: QRCode }) =>
      QRCode.toDataURL(handoverUrl(data.public_token), { width: QR_SIZE * 2, margin: 2 }).then((url) => {
        if (active) setQrDataUrl(url);
      }),
    );
    return () => {
      active = false;
    };
  }, [data.public_token]);

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

  async function getCardImage(): Promise<File | null> {
    const { toBlob } = await import("html-to-image");
    const blob = await toBlob(cardRef.current!, { pixelRatio: 2, width: CARD_WIDTH });
    return blob ? new File([blob], `pickup-${data.short_code}.png`, { type: "image/png" }) : null;
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
    <div className="flex flex-col gap-4">
      <div
        ref={cardRef}
        className="mx-auto flex w-full max-w-[600px] flex-col gap-4 rounded-2xl bg-white p-6 text-slate-900"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Component pickup</h2>
            <p className="font-mono text-sm font-semibold text-emerald-600">{data.short_code}</p>
          </div>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for request ${data.short_code}`}
              width={QR_SIZE}
              height={QR_SIZE}
              className="rounded-lg"
            />
          ) : (
            <div style={{ width: QR_SIZE, height: QR_SIZE }} className="rounded-lg bg-slate-100" />
          )}
        </div>

        <div>
          <p className="text-sm font-medium">{data.requester_name}</p>
          <p className="text-sm text-slate-500">{data.phone}</p>
          {data.project_name && <p className="text-sm text-slate-500">{data.project_name}</p>}
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
              <th className="py-2">Component</th>
              <th className="py-2">Location</th>
              <th className="py-2 text-right">Qty</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.name} className="border-b border-slate-100">
                <td className="py-2">{item.name}</td>
                <td className="py-2 text-slate-500">{item.location ?? "—"}</td>
                <td className="py-2 text-right">{item.approved_qty}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.expires_at && (
          <p className="text-xs text-slate-500">
            Valid until {new Date(data.expires_at).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
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
      <div className="flex flex-wrap gap-2">
        <ShareHandoverButtons
          getImage={getCardImage}
          data={{
            code: data.short_code,
            requesterName: data.requester_name,
            projectName: data.project_name,
            items: data.items.map((i) => ({ name: i.name, location: i.location, qty: i.approved_qty })),
            expiresAt: data.expires_at,
            publicToken: data.public_token,
          }}
        />
      </div>
    </div>
  );
}
