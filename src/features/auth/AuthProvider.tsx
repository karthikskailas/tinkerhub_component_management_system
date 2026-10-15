import { Turnstile } from "@marsidev/react-turnstile";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useOnlineStatus } from "../../lib/useOnlineStatus";
import { AuthContext } from "./AuthContext";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;

// A persisted supabase session lives under sb-<project>-auth-token.
function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && /^sb-.*-auth-token$/.test(key)) return true;
    }
  } catch {
    // storage blocked: treat as no stored session
  }
  return false;
}

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];

export function AuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const online = useOnlineStatus();

  const signInAnon = useCallback(async (captchaToken?: string) => {
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInAnonymously(
      captchaToken ? { options: { captchaToken } } : undefined,
    );
    if (signInError) {
      setError(signInError.message);
      setNeedsCaptcha(false);
      return;
    }
    setUser(data.user);
    setNeedsCaptcha(false);
  }, []);

  // Resolve whatever session already exists, once. A refresh that fails for
  // network reasons is retried with backoff and never leads to a new anonymous
  // user: only a session that is definitively gone (no stored token, or the
  // server rejected the refresh token) does. Auth events keep state in sync.
  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    async function resolve(attempt: number) {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setUser(data.session.user);
        setReady(true);
        return;
      }
      const undetermined =
        (sessionError && isAuthRetryableFetchError(sessionError)) ||
        (hasStoredSession() && !navigator.onLine);
      if (undetermined) {
        timer = window.setTimeout(
          () => void resolve(attempt + 1),
          BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)],
        );
        return;
      }
      setUser(null);
      setReady(true);
    }
    void resolve(0);

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setReady(true);
      } else if (session) {
        // SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION with a session.
        setUser(session.user);
        setReady(true);
      }
      // A null session on any other event is "not known yet", never a reason to sign in again.
    });

    return () => {
      active = false;
      window.clearTimeout(timer);
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Client routes need *some* session to call RPCs under RLS, so once we
  // know there isn't one, start anonymous sign-in. Admin routes never do
  // this automatically — a signed-out visitor on /admin just stays signed
  // out until they log in, and this effect re-fires the moment they
  // navigate to a client route (e.g. right after staff sign-out).
  useEffect(() => {
    if (!ready || user || needsCaptcha || isAdminRoute || !online) return;
    if (TURNSTILE_SITE_KEY) {
      setNeedsCaptcha(true);
    } else {
      void signInAnon();
    }
  }, [ready, user, needsCaptcha, isAdminRoute, online, signInAnon]);

  const retry = useCallback(() => {
    setError(null);
    setNeedsCaptcha(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAnonymous: user?.is_anonymous ?? false, ready, error, retry }}
    >
      {needsCaptcha && TURNSTILE_SITE_KEY && (
        <div>
          <Turnstile
            siteKey={TURNSTILE_SITE_KEY}
            options={{ size: "invisible" }}
            onSuccess={(token) => void signInAnon(token)}
            onError={() => setError("Captcha verification failed.")}
          />
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}
