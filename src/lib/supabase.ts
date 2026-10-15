import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.",
  );
}

const RPC_TIMEOUT_MS = 20_000;

// No screen should be able to spin forever on a dropped connection: every
// REST/RPC request (table queries and .rpc() calls, which both go through
// /rest/v1/) gets a hard ceiling, after which it fails like any other
// network error (parseSupabaseError's isNetworkError path handles an
// AbortError the same as a failed fetch) and the caller's own "Retry"
// control takes over. Storage uploads/downloads are excluded — a
// screenshot upload on a slow connection legitimately needs longer than
// 20s, and they're already size-capped (compressed to ~300KB) rather than
// time-capped.
function timeoutFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes("/storage/v1/")) return fetch(input, init);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener("abort", () => controller.abort());
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

// Blocked or full storage must never crash the app: reads fall back to "no
// session" and writes are dropped.
const safeStorage = {
  getItem: (key: string) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem: (key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { fetch: timeoutFetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: safeStorage,
  },
});
