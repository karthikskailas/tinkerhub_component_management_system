// Creates a staff (admin / inventory_manager) account. Callable only by an
// active admin. Anonymous and non-admin callers are rejected.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

interface CreateStaffBody {
  email: string;
  password: string;
  role: "admin" | "inventory_manager";
  display_name?: string;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["admin", "inventory_manager"];

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "missing authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Resolve the caller from their own JWT (user-scoped client).
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerError } = await callerClient.auth
    .getUser();

  if (callerError || !callerData?.user) {
    return jsonResponse({ error: "invalid or expired session" }, 401);
  }
  if (callerData.user.is_anonymous) {
    return jsonResponse({ error: "anonymous users cannot create staff" }, 403);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: staffRow, error: staffError } = await adminClient
    .from("staff")
    .select("role, active")
    .eq("user_id", callerData.user.id)
    .maybeSingle();

  if (staffError) {
    return jsonResponse({ error: "failed to verify caller role" }, 500);
  }
  if (!staffRow || !staffRow.active || staffRow.role !== "admin") {
    return jsonResponse({ error: "admin role required" }, 403);
  }

  let body: CreateStaffBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  const { email, password, role, display_name } = body;

  if (!email || !EMAIL_RE.test(email)) {
    return jsonResponse({ error: "invalid email" }, 400);
  }
  if (!password || password.length < 8) {
    return jsonResponse({ error: "password must be at least 8 characters" }, 400);
  }
  if (!role || !ROLES.includes(role)) {
    return jsonResponse({ error: "role must be 'admin' or 'inventory_manager'" }, 400);
  }

  const { data: createdUser, error: createError } = await adminClient.auth.admin
    .createUser({ email, password, email_confirm: true });

  if (createError || !createdUser?.user) {
    const status = createError?.message?.toLowerCase().includes("already")
      ? 409
      : 500;
    return jsonResponse({ error: createError?.message ?? "failed to create user" }, status);
  }

  const newUserId = createdUser.user.id;

  const { error: insertError } = await adminClient.from("staff").insert({
    user_id: newUserId,
    role,
    display_name: display_name ?? null,
  });

  if (insertError) {
    // Roll back the auth user so we don't leave an orphaned account.
    await adminClient.auth.admin.deleteUser(newUserId);
    return jsonResponse({ error: "failed to create staff row, user rolled back" }, 500);
  }

  return jsonResponse({ user_id: newUserId, email, role }, 200);
});
