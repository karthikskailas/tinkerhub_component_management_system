import { createContext } from "react";
import type { User } from "@supabase/supabase-js";

export interface AuthState {
  user: User | null;
  isAnonymous: boolean;
  ready: boolean;
  error: string | null;
  retry: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);
