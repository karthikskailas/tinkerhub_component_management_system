import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/useAuth";
import { useStaffProfile } from "./useStaffProfile";
import type { StaffRole } from "./useStaffProfile";

interface NavItem {
  to: string;
  label: string;
  roles: StaffRole[];
  icon: (props: { className?: string }) => React.ReactElement;
}

function ReviewIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function IssueIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" />
      <path d="M12 11v9M4.5 6.5L12 11l7.5-4.5" />
    </svg>
  );
}
function InventoryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function ReturnsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M3 10h11a4 4 0 0 1 0 8h-2" />
      <path d="M7 6l-4 4 4 4" />
    </svg>
  );
}
function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function StaffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
    </svg>
  );
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/admin/review", label: "Review", roles: ["admin"], icon: ReviewIcon },
  { to: "/admin/issue", label: "Issue", roles: ["admin", "inventory_manager"], icon: IssueIcon },
  { to: "/admin/inventory", label: "Inventory", roles: ["admin", "inventory_manager"], icon: InventoryIcon },
  { to: "/admin/returns", label: "Returns", roles: ["admin", "inventory_manager"], icon: ReturnsIcon },
  { to: "/admin/history", label: "History", roles: ["admin", "inventory_manager"], icon: HistoryIcon },
  {
    to: "/admin/handover-staff",
    label: "On-site staff",
    roles: ["admin", "inventory_manager"],
    icon: StaffIcon,
  },
];

// Keep the staff shell out of search engines without pulling in a head-
// management library for one tag.
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);
}

export function SidebarContent({
  items,
  roleLabel,
  displayName,
  onNavigate,
  onSignOut,
}: {
  items: NavItem[];
  roleLabel: string | null;
  displayName: string;
  onNavigate?: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-[#0c1912] text-emerald-50">
      <div className="flex items-center gap-2 px-5 pt-6 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </div>
        <span className="text-sm font-semibold tracking-wide">Component Inventory</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-emerald-200/40 uppercase">
          Navigation
        </p>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-500/15 text-white"
                  : "text-emerald-100/70 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-300">
            {displayName.slice(0, 1).toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{displayName}</p>
            {roleLabel && <p className="truncate text-xs text-emerald-200/50">{roleLabel}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-emerald-100/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AdminLayout() {
  useNoIndex();
  const { user } = useAuth();
  const { profile } = useStaffProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !profile || item.roles.includes(profile.role),
  );
  const displayName = profile?.display_name || user?.email || "Staff";
  const roleLabel = profile ? (profile.role === "admin" ? "Admin" : "Inventory Manager") : null;

  async function signOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="flex h-dvh gap-3 overflow-hidden bg-background p-0 lg:bg-[#06150e] lg:p-3">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block lg:rounded-2xl lg:overflow-hidden">
        <SidebarContent items={visibleItems} roleLabel={roleLabel} displayName={displayName} onSignOut={signOut} />
      </aside>

      {/* Mobile off-canvas sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative h-full w-64">
            <SidebarContent
              items={visibleItems}
              roleLabel={roleLabel}
              displayName={displayName}
              onNavigate={() => setMobileNavOpen(false)}
              onSignOut={signOut}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col bg-background lg:rounded-2xl lg:overflow-hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation menu"
          className="m-3 flex h-9 w-9 items-center justify-center self-start rounded-lg bg-surface text-foreground shadow-surface lg:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>

        {/* Bottom tab bar for small screens, so core nav stays reachable without the drawer */}
        <nav className="flex border-t border-border bg-surface lg:hidden">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
                  isActive ? "text-accent" : "text-muted"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
