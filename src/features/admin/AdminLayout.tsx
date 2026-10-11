import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/useAuth";
import { useStaffProfile } from "./useStaffProfile";
import type { StaffRole } from "./useStaffProfile";

interface NavItem {
  to: string;
  label: string;
  roles: StaffRole[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/admin/review", label: "Review", roles: ["admin"] },
  { to: "/admin/issue", label: "Issue", roles: ["admin", "inventory_manager"] },
  { to: "/admin/inventory", label: "Inventory", roles: ["admin", "inventory_manager"] },
  { to: "/admin/returns", label: "Returns", roles: ["admin", "inventory_manager"] },
  { to: "/admin/history", label: "History", roles: ["admin", "inventory_manager"] },
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

export function AdminLayout() {
  useNoIndex();
  const { user } = useAuth();
  const { profile } = useStaffProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !profile || item.roles.includes(profile.role),
  );

  async function signOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="p-4">
          <p className="text-sm font-semibold text-slate-900">Staff</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `min-h-11 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">
              {profile?.display_name || user?.email}
            </p>
            {profile && (
              <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {profile.role === "admin" ? "Admin" : "Inventory Manager"}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={signOut}
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Sign out
          </button>
        </header>

        <main className="flex-1 pb-16 md:pb-0">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white md:hidden">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-14 flex-1 items-center justify-center text-sm font-medium ${
                  isActive ? "text-indigo-700" : "text-slate-500"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
