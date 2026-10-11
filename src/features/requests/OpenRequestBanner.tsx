import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LAST_REQUEST_ID_KEY, local } from "../../lib/storage";
import { supabase } from "../../lib/supabase";

const OPEN_STATUSES = new Set(["pending", "approved", "issued"]);

async function fetchStatus(id: string) {
  const { data, error } = await supabase
    .from("requests")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.status ?? null;
}

export function OpenRequestBanner() {
  const requestId = local.get(LAST_REQUEST_ID_KEY);

  const query = useQuery({
    queryKey: ["open_request_check", requestId],
    queryFn: () => fetchStatus(requestId!),
    enabled: !!requestId,
    retry: false,
  });

  if (!requestId || !query.data || !OPEN_STATUSES.has(query.data)) return null;

  return (
    <Link
      to={`/request/${requestId}`}
      className="mb-4 block rounded-lg bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700"
    >
      You have an open request — tap to view status →
    </Link>
  );
}
