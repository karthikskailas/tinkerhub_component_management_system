// Deletes screenshots queued by the requests.status trigger (see
// supabase/migrations/0010_screenshot_cleanup.sql) once a request has left
// the "needs review" state. Runs on a cron schedule (see
// supabase/schedule_cleanup.sql) but can also be triggered by an admin.
//
// verify_jwt is OFF for this function (set in config.toml) because the
// cron path authenticates with a shared secret, not a user JWT — auth is
// handled entirely below instead.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const BATCH_SIZE = 100;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function isAuthorized(req: Request): Promise<boolean> {
  const cronSecret = Deno.env.get("CLEANUP_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (cronSecret && providedSecret && providedSecret === cronSecret) {
    return true;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData?.user || callerData.user.is_anonymous) return false;

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: staffRow } = await adminClient
    .from("staff")
    .select("role, active")
    .eq("user_id", callerData.user.id)
    .maybeSingle();

  return !!staffRow && staffRow.active && staffRow.role === "admin";
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  const hasSecretHeader = !!req.headers.get("x-cron-secret");
  const hasAuthHeader = !!req.headers.get("Authorization");
  if (!hasSecretHeader && !hasAuthHeader) {
    return jsonResponse({ error: "missing credentials" }, 401);
  }
  if (!(await isAuthorized(req))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: queueRows, error: queueError } = await adminClient
    .from("storage_cleanup_queue")
    .select("id, bucket, path")
    .is("done_at", null)
    .order("queued_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (queueError) {
    return jsonResponse({ error: "failed to read cleanup queue" }, 500);
  }

  let processed = 0;
  let failed = 0;

  const byBucket = new Map<string, { id: number; path: string }[]>();
  for (const row of queueRows ?? []) {
    const list = byBucket.get(row.bucket) ?? [];
    list.push({ id: row.id, path: row.path });
    byBucket.set(row.bucket, list);
  }

  for (const [bucket, rows] of byBucket) {
    const paths = rows.map((r) => r.path);
    // storage.remove() is idempotent for paths that don't exist — a path
    // that's already gone is treated the same as one just removed.
    const { error: removeError } = await adminClient.storage.from(bucket).remove(paths);

    if (removeError) {
      failed += rows.length;
      continue;
    }

    const now = new Date().toISOString();
    const ids = rows.map((r) => r.id);

    const { error: markDoneError } = await adminClient
      .from("storage_cleanup_queue")
      .update({ done_at: now })
      .in("id", ids);

    const { error: markRequestError } = await adminClient
      .from("requests")
      .update({ screenshot_deleted_at: now })
      .in("screenshot_path", paths);

    if (markDoneError || markRequestError) {
      failed += rows.length;
    } else {
      processed += rows.length;
    }
  }

  return jsonResponse({ processed, failed }, 200);
});
