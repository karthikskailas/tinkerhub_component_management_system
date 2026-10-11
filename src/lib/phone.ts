// Matches the backend's normalization in submit_request/find_projects:
// strip everything but digits, keep the last 10 (handles +91, spaces, dashes).
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-10);
}

export function isValidIndianMobile(raw: string): boolean {
  const normalized = normalizePhone(raw);
  return /^[6-9]\d{9}$/.test(normalized);
}
