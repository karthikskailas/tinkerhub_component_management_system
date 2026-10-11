import type { QueryClient } from "@tanstack/react-query";

// issue_request/verify_return change a request's status, its components'
// count/reserved, and sometimes auto-complete the request — all of which
// other tabs' counts and lists depend on, so every one of them needs a
// fresh fetch after either mutation, not just the tab the action happened
// in (so e.g. Issue's own invalidate call wouldn't accidentally leave
// Returns/History/Inventory/Review showing stale counts).
export function invalidateAfterRequestMutation(queryClient: QueryClient): void {
  for (const key of [
    "issue_requests",
    "returns_requests",
    "history_requests",
    "components",
    "approved_requests",
  ]) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}
