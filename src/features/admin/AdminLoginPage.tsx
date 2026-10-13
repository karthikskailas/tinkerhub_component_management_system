import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/useAuth";
import { roleHome, useStaffProfile } from "./useStaffProfile";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function mapAuthError(message: string): string {
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Wrong email or password.";
  }
  if (message.toLowerCase().includes("captcha")) {
    return "Captcha failed, try again.";
  }
  if (message.toLowerCase().includes("fetch") || message.toLowerCase().includes("network")) {
    return "Network error, try again.";
  }
  return "Couldn't sign in. Please try again.";
}

export function AdminLoginPage() {
  const { user, isAnonymous, ready } = useAuth();
  const { profile, isLoading: profileLoading } = useStaffProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(
    (location.state as { error?: string } | null)?.error ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setFailedAttempts(0);
        setRemainingSeconds(0);
      } else {
        setRemainingSeconds(remaining);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  // Already signed in as active staff? Skip the login form entirely.
  if (ready && user && !isAnonymous && !profileLoading && profile) {
    return <Navigate to={roleHome(profile.role)} replace />;
  }

  const locked = !!lockedUntil;

  async function onSubmit(values: LoginFormValues) {
    if (locked) return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
        options: captchaToken ? { captchaToken } : undefined,
      });

      if (error || !data.user) {
        turnstileRef.current?.reset();
        setCaptchaToken(null);
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        if (nextAttempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
        }
        setSubmitError(mapAuthError(error?.message ?? ""));
        return;
      }

      const { data: staffRow, error: staffError } = await supabase
        .from("staff")
        .select("role, active")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (staffError || !staffRow || !staffRow.active) {
        await supabase.auth.signOut();
        setSubmitError("This account does not have staff access.");
        return;
      }

      queryClient.clear();
      navigate(roleHome(staffRow.role), { replace: true });
    } catch {
      setSubmitError("Network error, try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 text-surface-foreground shadow-surface sm:p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold">Staff sign in</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            error={errors.email?.message}
            disabled={locked}
            {...register("email")}
          />

          <div className="flex flex-col gap-1.5">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              error={errors.password?.message}
              disabled={locked}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="self-start text-xs font-medium text-accent hover:underline"
            >
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </div>

          {TURNSTILE_SITE_KEY && (
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
            />
          )}

          {submitError && <p className="text-sm text-danger">{submitError}</p>}

          {locked && (
            <p className="text-sm text-warning">
              Too many attempts. Try again in {remainingSeconds}s.
            </p>
          )}

          <Button
            type="submit"
            loading={submitting}
            disabled={locked || (!!TURNSTILE_SITE_KEY && !captchaToken)}
          >
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
