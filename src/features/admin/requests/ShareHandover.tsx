import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../components/ui/Toast";
import { handoverUrl } from "./api";

export interface HandoverShareData {
  code: string;
  requesterName: string;
  projectName: string | null;
  items: { name: string; location: string | null; qty: number }[];
  expiresAt: string | null;
  publicToken: string;
}

// No screenshot, no signed URL, no phone number: just what on-site staff need.
export function buildHandoverText(d: HandoverShareData): string {
  const lines = [
    `Handover ${d.code}`,
    `Borrower: ${d.requesterName}`,
    d.projectName ? `Project: ${d.projectName}` : null,
    "",
    ...d.items.map((i) => `- ${i.name} x ${i.qty} (${i.location ?? "no location"})`),
    "",
    d.expiresAt ? `Valid until ${new Date(d.expiresAt).toLocaleString()}` : null,
    handoverUrl(d.publicToken),
    "",
    "Open the link, pick your name and swipe to confirm after handing over.",
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

interface Props {
  data: HandoverShareData;
  /** Optional card image to attach when the browser can share files. */
  getImage?: () => Promise<File | null>;
}

export function ShareHandoverButtons({ data, getImage }: Props) {
  const [sharing, setSharing] = useState(false);
  const text = buildHandoverText(data);

  async function send() {
    setSharing(true);
    try {
      const file = getImage ? await getImage().catch(() => null) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Handover ${data.code}`, text });
          return;
        } catch {
          // cancelled or failed: fall through to wa.me
        }
      }
      // No number: the IM picks the on-site staff chat inside WhatsApp.
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } finally {
      setSharing(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Text copied.");
    } catch {
      toast.error("Couldn't copy the text.");
    }
  }

  return (
    <>
      <Button loading={sharing} onClick={send}>
        Send to on-site staff
      </Button>
      <Button variant="ghost" onClick={copy}>
        Copy text
      </Button>
    </>
  );
}
