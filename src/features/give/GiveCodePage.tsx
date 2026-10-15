import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { parseSupabaseError } from "../../lib/errors";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/useAuth";

// Fallback for when the QR can't be scanned: type the borrower's 8-character
// code and continue to the same handover page.
export function GiveCodePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.append(robots);
    return () => robots.remove();
  }, []);

  const clean = code.replace(/[^0-9a-f]/gi, "").toUpperCase();

  async function open() {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("resolve_handover_code", { p_code: clean });
    setBusy(false);
    if (rpcError) {
      const parsed = parseSupabaseError(rpcError);
      setError(
        parsed.code === "E_NOT_FOUND"
          ? "No pending handover for that code. Check the code, or the request may already be handed over."
          : parsed.message,
      );
      return;
    }
    navigate(`/give/${data}`);
  }

  return (
    <div className="min-h-dvh bg-transparent sm:px-4 sm:py-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (clean.length === 8 && user) void open();
        }}
        className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4 sm:rounded-3xl sm:bg-surface sm:p-8 sm:shadow-surface"
      >
        <p className="text-base font-bold tracking-tight text-foreground">
          TinkerSpace <span className="text-accent">Maker Cart</span>
        </p>
        <h1 className="text-2xl font-bold text-foreground">Hand over components</h1>
        <p className="text-base text-muted">
          Scan the borrower's QR with your phone camera. If it won't scan, type the 8-character
          code shown under it.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-semibold text-foreground">Request code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={12}
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            placeholder="A1B2C3D4"
            className="min-h-14 rounded-xl border-2 border-border bg-surface px-3 font-mono text-2xl uppercase tracking-widest text-foreground focus:border-accent focus:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-base text-danger">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth loading={busy} disabled={clean.length !== 8 || !user} className="rounded-full">
          Continue
        </Button>
      </form>
    </div>
  );
}
