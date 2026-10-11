import { Turnstile } from "@marsidev/react-turnstile";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { AuthContext } from "./AuthContext";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;

export function AuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsCaptcha, setNeedsCaptcha] = useState(false);

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

  // Resolve whatever session already exists, once, and keep it in sync with
  // every subsequent auth event (sign-in, sign-out, token refresh). This
  // never decides whether to START an anonymous session — that's the next
  // effect's job, reacting to the result below plus the current route.
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Client routes need *some* session to call RPCs under RLS, so once we
  // know there isn't one, start anonymous sign-in. Admin routes never do
  // this automatically — a signed-out visitor on /admin just stays signed
  // out until they log in, and this effect re-fires the moment they
  // navigate to a client route (e.g. right after staff sign-out).
  useEffect(() => {
    if (!ready || user || needsCaptcha || isAdminRoute) return;
    if (TURNSTILE_SITE_KEY) {
      setNeedsCaptcha(true);
    } else {
      void signInAnon();
    }
  }, [ready, user, needsCaptcha, isAdminRoute, signInAnon]);

  const retry = useCallback(() => {
    setError(null);
    setNeedsCaptcha(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAnonymous: user?.is_anonymous ?? false, ready, error, retry }}
    >
      {needsCaptcha && TURNSTILE_SITE_KEY && (
        <div className="hidden">
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
