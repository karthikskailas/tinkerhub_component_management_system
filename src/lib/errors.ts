// Backend RPCs raise `raise exception 'E_CODE: human text' using errcode = 'P0001'`.
// PostgREST passes that string through as error.message verbatim, so we can
// split on the first ':' to recover the code and the backend's own detail.

const FRIENDLY: Record<string, string> = {
  E_INVALID_PHONE: "Enter a valid 10-digit mobile number.",
  E_INVALID_INPUT: "Please check the highlighted fields.",
  E_INVALID_SCREENSHOT: "Please upload a payment/registration screenshot.",
  E_INVALID_ITEMS: "Please check the selected components.",
  E_TOO_MANY_ITEMS: "You can request at most 50 components in one go.",
  E_DUPLICATE_ITEM: "The same component is selected twice.",
  E_TOO_MANY_OPEN_REQUESTS:
    "You already have 3 open requests. Please wait for one to be resolved before submitting another.",
  E_PROJECT_NOT_FOUND: "That project doesn't match the phone number.",
  E_NOT_CANCELLABLE: "This request was already reviewed and can no longer be cancelled.",
  E_NOT_FOUND: "We couldn't find that.",
  E_RATE_LIMIT: "Too many lookups — please wait a bit and try again.",
  E_FORBIDDEN: "You don't have permission to do that.",
  E_INVALID_STATUS: "This request is no longer in a state that allows that action.",
  E_EXPIRED: "This approval has expired.",
};

const DEFAULT_MESSAGE = "Something went wrong. Please try again.";

export interface ParsedError {
  code: string | null;
  detail: string | null;
  message: string;
}

export function parseSupabaseError(error: unknown): ParsedError {
  const raw = extractMessage(error);
  if (!raw) return { code: null, detail: null, message: DEFAULT_MESSAGE };

  const match = /^([A-Z][A-Z0-9_]*):\s*(.*)$/s.exec(raw);
  if (!match) {
    return { code: null, detail: null, message: DEFAULT_MESSAGE };
  }

  const [, code, detail] = match;
  // Backend messages (e.g. E_STOCK: "Arduino Uno" only 0 available) are
  // already human-readable, including the component name, so prefer them
  // verbatim for codes we don't have a canned friendlier phrasing for.
  const friendly = FRIENDLY[code];
  return {
    code,
    detail,
    message: friendly ?? detail ?? DEFAULT_MESSAGE,
  };
}

function extractMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : null;
  }
  return null;
}
