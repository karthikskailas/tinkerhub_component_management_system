import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SkeletonLines } from "../../components/ui/Skeleton";
import { SwipeConfirm } from "../../components/ui/SwipeConfirm";
import { parseSupabaseError } from "../../lib/errors";
import { supabase } from "../../lib/supabase";
import { useOnlineStatus } from "../../lib/useOnlineStatus";
import { useAuth } from "../auth/useAuth";

interface HandoverPage {
  code: string;
  requester_name: string;
  phone_last4: string;
  project_name: string | null;
  expires_at: string | null;
  items: { name: string; location: string | null; qty: number }[];
  staff: { id: string; name: string; designation: string | null }[];
  already_confirmed: { by: string; at: string } | null;
}

const OTHER = "__other__";

// This page must never be indexed or leak its token through the Referer header.
function useHeadMeta() {
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.append(robots, referrer);
    return () => {
      robots.remove();
      referrer.remove();
    };
  }, []);
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-transparent sm:px-4 sm:py-6">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4 sm:rounded-3xl sm:bg-surface sm:p-8 sm:shadow-surface">
        <p className="text-base font-bold tracking-tight text-foreground">
          TinkerSpace <span className="text-accent">Maker Cart</span>
        </p>
        {children}
      </div>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-base text-muted">{body}</p>
    </Shell>
  );
}

const INVALID_COPY: Record<string, { title: string; body: string }> = {
  cancelled: {
    title: "This request was cancelled",
    body: "Don't hand anything over. Ask the inventory manager if you're unsure.",
  },
  rejected: {
    title: "This request was not approved",
    body: "Don't hand anything over. Ask the inventory manager if you're unsure.",
  },
  expired: {
    title: "This approval has expired",
    body: "The components went back to stock. Ask the borrower to start a new request.",
  },
  issued: {
    title: "Already handed over",
    body: "The inventory manager has already marked this request as given.",
  },
  returned: {
    title: "Already handed over",
    body: "The inventory manager has already marked this request as given.",
  },
};

export function GivePage() {
  useHeadMeta();
  const { token } = useParams<{ token: string }>();
  const { user, isAnonymous } = useAuth();
  const online = useOnlineStatus();

  const [staffId, setStaffId] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherDesignation, setOtherDesignation] = useState("");
  const [thanks, setThanks] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["handover_page", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_handover_page", { p_token: token! });
      if (error) throw error;
      return data as unknown as HandoverPage;
    },
    enabled: !!user && !!token,
    retry: false,
  });

  const confirm = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("confirm_handover", {
        p_token: token!,
        ...(staffId === OTHER
          ? { p_other_name: otherName.trim(), p_other_designation: otherDesignation.trim() }
          : { p_staff_id: staffId }),
      });
      if (error) throw error;
      return data as unknown as { confirmed_by: string; confirmed_at: string };
    },
    onSuccess: (result) => setThanks(result.confirmed_by),
    onError: (error) => {
      // Someone else confirmed first: show who, with no control.
      if (parseSupabaseError(error).code === "E_ALREADY_CONFIRMED") void query.refetch();
    },
  });

  if (!user || query.isLoading) {
    return (
      <Shell>
        <SkeletonLines count={5} />
      </Shell>
    );
  }

  if (query.isError || !query.data) {
    const parsed = parseSupabaseError(query.error);
    if (parsed.code === "E_NOT_FOUND") {
      return (
        <Message
          title="We can't find this link"
          body="Check that the whole link or QR was scanned. You can also go to /give and type the borrower's 8-character code."
        />
      );
    }
    if (parsed.code === "E_RATE_LIMIT") {
      return (
        <Message
          title="Too many tries"
          body="Please wait a few minutes and scan again."
        />
      );
    }
    if (parsed.code === "E_INVALID_STATUS") {
      const copy = INVALID_COPY[parsed.detail?.trim() ?? ""] ?? {
        title: "Not available",
        body: "This request can't be handed over right now. Ask the inventory manager.",
      };
      return <Message {...copy} />;
    }
    return (
      <Shell>
        <p className="text-base text-danger">We couldn't load this page. Check your connection.</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="inline-flex min-h-11 items-center self-start rounded-full bg-accent px-5 text-base font-semibold text-accent-foreground"
        >
          Try again
        </button>
      </Shell>
    );
  }

  const page = query.data;

  if (thanks) {
    return (
      <Message
        title={`Thank you, ${thanks}`}
        body="The inventory manager has been notified."
      />
    );
  }

  if (page.already_confirmed) {
    return (
      <Message
        title="Handover already confirmed"
        body={`Confirmed by ${page.already_confirmed.by} on ${formatWhen(page.already_confirmed.at)}.`}
      />
    );
  }

  const otherValid = otherName.trim().length >= 2 && otherDesignation.trim().length >= 2;
  const complete = staffId === OTHER ? otherValid : staffId !== "";

  return (
    <Shell>
      {!isAnonymous && (
        <div className="flex flex-col gap-2 rounded-xl bg-accent/10 p-4">
          <p className="text-base font-semibold text-foreground">You're signed in as staff</p>
          <Link
            to={`/admin/issue?code=${page.code}`}
            className="inline-flex min-h-11 items-center self-start rounded-full bg-accent px-5 text-base font-semibold text-accent-foreground"
          >
            Open in Issue to mark as given
          </Link>
        </div>
      )}

      <h1 className="text-xl font-bold text-foreground">
        Check the person's name, then hand over these components
      </h1>

      <div className="flex flex-col gap-1 rounded-xl bg-accent/10 p-4">
        <p className="text-sm font-medium uppercase tracking-wider text-muted">Request code</p>
        <p className="font-mono text-4xl font-bold tracking-wider text-foreground">{page.code}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{page.requester_name}</p>
        <p className="text-base text-muted">Phone ending ••••{page.phone_last4}</p>
        {page.project_name && <p className="text-base text-foreground">{page.project_name}</p>}
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-xl bg-surface px-4 shadow-surface">
        {page.items.map((item) => (
          <li key={`${item.name}-${item.location}`} className="flex flex-col gap-0.5 py-3">
            <span className="text-lg font-semibold text-foreground">
              {item.name} <span className="font-mono">x {item.qty}</span>
            </span>
            <span className="text-base font-bold text-accent">
              {item.location ?? "Location not set"}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1 rounded-xl border-2 border-warning/50 bg-warning-soft p-4">
        <p className="text-base font-bold text-foreground">Message for the borrower</p>
        <p className="text-base text-foreground">
          After finishing your project, return the components to the inventory manager, space
          manager or lab staff. If nobody is available, hand them to the security desk and note
          their name and designation. You must upload a photo of the components when you return
          them.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-base font-semibold text-foreground">Your name</span>
        <select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="min-h-12 rounded-xl border-2 border-border bg-surface px-3 text-base text-foreground focus:border-accent focus:outline-none"
        >
          <option value="" disabled>
            Select your name
          </option>
          {page.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.designation ? `${s.name} · ${s.designation}` : s.name}
            </option>
          ))}
          <option value={OTHER}>Someone else</option>
        </select>
      </label>

      {staffId === OTHER && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-semibold text-foreground">Your full name</span>
            <input
              value={otherName}
              maxLength={60}
              onChange={(e) => setOtherName(e.target.value)}
              className="min-h-12 rounded-xl border-2 border-border bg-surface px-3 text-base text-foreground focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-semibold text-foreground">Designation</span>
            <input
              value={otherDesignation}
              maxLength={60}
              onChange={(e) => setOtherDesignation(e.target.value)}
              className="min-h-12 rounded-xl border-2 border-border bg-surface px-3 text-base text-foreground focus:border-accent focus:outline-none"
            />
          </label>
        </div>
      )}

      {confirm.isError && parseSupabaseError(confirm.error).code !== "E_ALREADY_CONFIRMED" && (
        <p role="alert" className="text-base text-danger">
          {parseSupabaseError(confirm.error).message}
        </p>
      )}
      {!online && <p className="text-sm text-muted">You're offline. Reconnect to confirm.</p>}

      <SwipeConfirm
        label="Swipe to confirm handover"
        disabled={!complete || !online}
        onConfirm={async () => {
          await confirm.mutateAsync().catch(() => undefined);
        }}
      />
    </Shell>
  );
}
