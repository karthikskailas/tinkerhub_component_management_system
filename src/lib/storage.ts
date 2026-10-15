// Thin, try/catch-wrapped localStorage/sessionStorage helpers. Storage can
// throw (private browsing, quota, disabled cookies) — every call here is
// safe to use without its own try/catch at the call site.

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

export const local = {
  get: (key: string) => safeGet(window.localStorage, key),
  set: (key: string, value: string) => safeSet(window.localStorage, key, value),
  remove: (key: string) => safeRemove(window.localStorage, key),
};

export const session = {
  getJSON: <T>(key: string): T | null => {
    const raw = safeGet(window.sessionStorage, key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJSON: (key: string, value: unknown) => {
    try {
      safeSet(window.sessionStorage, key, JSON.stringify(value));
    } catch {
      // ignore (e.g. circular structure, shouldn't happen for our draft shape)
    }
  },
  remove: (key: string) => safeRemove(window.sessionStorage, key),
};

export const LAST_REQUEST_ID_KEY = "inv.lastRequestId";
export const WIZARD_DRAFT_KEY = "inv.wizardDraft";
export const LAST_CONTACT_KEY = "inv.lastContact";

// Up to 5 of this device's most recent requests: lets /request/:id fall back to
// the public status link when the anonymous session is gone.
export const MY_REQUESTS_KEY = "inv.myRequests";

export interface SavedRequest {
  id: string;
  token: string;
  createdAt: string;
}

export function getSavedRequests(): SavedRequest[] {
  try {
    const list = JSON.parse(local.get(MY_REQUESTS_KEY) ?? "[]");
    return Array.isArray(list)
      ? list.filter((r) => typeof r?.id === "string" && typeof r?.token === "string").slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

export function saveRequest(entry: SavedRequest): void {
  const rest = getSavedRequests().filter((r) => r.id !== entry.id);
  local.set(MY_REQUESTS_KEY, JSON.stringify([entry, ...rest].slice(0, 5)));
}
