import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { Database } from "../../types/database.types";
import { useAuth } from "../auth/useAuth";

export type StaffRole = Database["public"]["Enums"]["staff_role"];

export interface StaffProfile {
  user_id: string;
  role: StaffRole;
  display_name: string | null;
  active: boolean;
}

async function fetchStaffProfile(userId: string): Promise<StaffProfile | null> {
  const { data, error } = await supabase
    .from("staff")
    .select("user_id, role, display_name, active")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function useStaffProfile() {
  const { user, isAnonymous } = useAuth();
  const enabled = !!user && !isAnonymous;

  const query = useQuery({
    queryKey: ["staff_profile", user?.id],
    queryFn: () => fetchStaffProfile(user!.id),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const profile = enabled ? query.data ?? null : null;
  const isStaff = !!profile && profile.active;
  const isAdmin = isStaff && profile?.role === "admin";

  return {
    profile,
    isLoading: enabled && query.isLoading,
    isStaff,
    isAdmin,
  };
}

export function roleHome(role: StaffRole): string {
  return role === "admin" ? "/admin/review" : "/admin/inventory";
}
