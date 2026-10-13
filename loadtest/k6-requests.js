// k6 load test for the client request flow: anonymous sign-in, browse the
// catalog, submit a request, poll its status.
//
// WARNING: do NOT run this against the production Supabase project. Point
// it at a disposable test project (its own URL + anon key) — it creates
// real anonymous users, storage objects, projects and requests. Running it
// against prod will pollute real data and consume real quota.
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_ANON_KEY=xxxx \
//   k6 run loadtest/k6-requests.js
//
// Override concurrency/duration (default is a safe 10 VUs, not the ~50 the
// task is sized for — raise VUS only against a test project):
//   VUS=50 DURATION=2m k6 run loadtest/k6-requests.js
//
// No staff/service-role key is used anywhere in this script — only the
// public anon key, same as the real client app.
import http from "k6/http";
import encoding from "k6/encoding";
import { check, sleep } from "k6";

const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON_KEY = __ENV.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY env vars (anon key only, never service role).");
}

export const options = {
  vus: Number(__ENV.VUS) || 10,
  duration: __ENV.DURATION || "1m",
  thresholds: {
    http_req_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
  },
};

// 1x1 transparent PNG, used as a stand-in screenshot upload.
const TINY_PNG = encoding.b64decode(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
);

function authHeaders(accessToken) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export default function () {
  // 1. Anonymous sign-in (same endpoint supabase-js's signInAnonymously hits).
  const signInRes = http.post(`${SUPABASE_URL}/auth/v1/signup`, "{}", {
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
  });
  const signedIn = check(signInRes, { "sign-in ok": (r) => r.status === 200 });
  if (!signedIn) return;

  const session = signInRes.json();
  const accessToken = session.access_token;
  const userId = session.user && session.user.id;
  if (!accessToken || !userId) return;

  sleep(1);

  // 2. Browse the catalog.
  const catalogRes = http.get(
    `${SUPABASE_URL}/rest/v1/component_catalog?select=id,name,available&limit=50`,
    { headers: authHeaders(accessToken) },
  );
  check(catalogRes, { "catalog ok": (r) => r.status === 200 });

  const catalog = catalogRes.json();
  if (!Array.isArray(catalog) || catalog.length === 0) return;
  const component = catalog[Math.floor(Math.random() * catalog.length)];

  sleep(1);

  // 3. Upload a screenshot (required by submit_request's ownership check).
  const screenshotPath = `${userId}/loadtest-${Date.now()}.png`;
  const uploadRes = http.post(
    `${SUPABASE_URL}/storage/v1/object/screenshots/${screenshotPath}`,
    TINY_PNG,
    {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "image/png",
      },
    },
  );
  const uploaded = check(uploadRes, { "upload ok": (r) => r.status === 200 });
  if (!uploaded) return;

  // 4. Submit the request.
  const submitRes = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/submit_request`,
    JSON.stringify({
      p_project_id: null,
      p_new_project: {
        name: `Load test project ${__VU}-${__ITER}`,
        description: "k6 load test",
        owner_name: "Load Tester",
      },
      p_requester_name: "Load Tester",
      p_phone: "5551234567",
      p_screenshot_path: screenshotPath,
      p_items: [{ component_id: component.id, qty: 1 }],
    }),
    { headers: authHeaders(accessToken) },
  );
  const submitted = check(submitRes, { "submit ok": (r) => r.status === 200 });
  if (!submitted) return;

  const [request] = submitRes.json();
  if (!request || !request.id) return;

  // 5. Poll status a few times, like the client wizard's confirmation page.
  for (let i = 0; i < 3; i++) {
    sleep(2);
    const statusRes = http.get(
      `${SUPABASE_URL}/rest/v1/requests?id=eq.${request.id}&select=status`,
      { headers: authHeaders(accessToken) },
    );
    check(statusRes, { "status poll ok": (r) => r.status === 200 });
  }
}
