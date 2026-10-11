// Phone numbers are stored normalized to 10 digits (see submit_request).
// WhatsApp's wa.me links want the full international number, no symbols.
export function toWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return `91${digits}`;
}

export function buildWhatsAppUrl(phone: string, text: string): string {
  return `https://wa.me/${toWhatsAppPhone(phone)}?text=${encodeURIComponent(text)}`;
}
