import { useOnlineStatus } from "../../lib/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white"
    >
      You're offline. Changes can't be saved until your connection comes back.
    </div>
  );
}
