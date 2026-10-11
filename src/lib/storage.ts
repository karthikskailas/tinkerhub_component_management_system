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
