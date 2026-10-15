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
  E_ALREADY_CONFIRMED: "This handover was already confirmed.",
  E_DUPLICATE: "That name is already on the list.",
  E_IN_USE:
    "This component appears in requests, so it can't be deleted. Set its count to 0 instead.",
  E_RETURNABLE_OUTSTANDING:
    "Can't mark this non-returnable while units are issued and not yet returned.",
  E_ALREADY_SUBMITTED: "A return was already submitted for this request.",
};

const DEFAULT_MESSAGE = "Something went wrong. Please try again.";
const NETWORK_MESSAGE = "Network error, try again.";

// Genuine network failures (offline, DNS, CORS, a dropped connection) never
// reach the backend at all, so they never look like "E_CODE: detail" — the
// browser/fetch layer's own wording is the only signal available. This list
// covers Chrome/Firefox/Safari's actual TypeError messages for a failed
// fetch, plus supabase-js's own network-error passthroughs.
const NETWORK_PATTERN = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i;

function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name?: unknown }).name) : "";
  const message = "message" in error ? String((error as { message?: unknown }).message) : "";
  // AbortError covers both the 20s request timeout (lib/supabase.ts) and a
  // user-cancelled export; either way "network error, try again" is the
  // right framing for a request that never got a response.
  if (name === "AbortError") return true;
  return name === "TypeError" && NETWORK_PATTERN.test(message);
}

export interface ParsedError {
  code: string | null;
  detail: string | null;
  message: string;
}

export function parseSupabaseError(error: unknown): ParsedError {
  if (isNetworkError(error)) {
    return { code: "E_NETWORK", detail: null, message: NETWORK_MESSAGE };
  }

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
