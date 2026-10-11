import { Navigate } from "react-router-dom";
import { roleHome, useStaffProfile } from "./useStaffProfile";

export function AdminHome() {
  const { profile } = useStaffProfile();
  // RequireStaff already guarantees an active staff row exists by the time
  // this renders, so profile is non-null in practice.
  return <Navigate to={profile ? roleHome(profile.role) : "/admin/login"} replace />;
}
