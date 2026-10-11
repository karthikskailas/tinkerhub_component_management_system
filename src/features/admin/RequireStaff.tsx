import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SkeletonLines } from "../../components/ui/Skeleton";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/useAuth";
import { roleHome, useStaffProfile } from "./useStaffProfile";
import type { StaffRole } from "./useStaffProfile";

interface RequireStaffProps {
  roles?: StaffRole[];
  children: ReactNode;
}

export function RequireStaff({ roles, children }: RequireStaffProps) {
  const { user, isAnonymous, ready } = useAuth();
  const { profile, isLoading, isStaff } = useStaffProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signingOut = useRef(false);

  const noSession = !user || isAnonymous;
  const inactiveStaff = !noSession && !isLoading && !isStaff;

  useEffect(() => {
    if (!ready || isLoading) return;

    if (noSession) {
      navigate("/admin/login", { replace: true });
      return;
    }

    if (inactiveStaff && !signingOut.current) {
      signingOut.current = true;
      void supabase.auth.signOut().then(() => {
        queryClient.clear();
        navigate("/admin/login", {
          replace: true,
          state: { error: "This account does not have staff access" },
        });
      });
    }
  }, [ready, isLoading, noSession, inactiveStaff, navigate, queryClient]);

  if (!ready || isLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <SkeletonLines count={4} />
      </div>
    );
  }

  if (noSession || inactiveStaff) return null;

  if (roles && profile && !roles.includes(profile.role)) {
    return <NotAuthorized homeHref={roleHome(profile.role)} />;
  }

  return <>{children}</>;
}

function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="mb-2 text-xl font-semibold text-slate-900">Not authorized</h1>
      <p className="mb-4 text-sm text-slate-500">
        Your role doesn't have access to this page.
      </p>
      <Link to={homeHref} className="text-sm font-medium text-indigo-600 underline">
        Go to your home page
      </Link>
    </div>
  );
}
