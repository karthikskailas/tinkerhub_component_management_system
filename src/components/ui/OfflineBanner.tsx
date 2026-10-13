import { useOnlineStatus } from "../../lib/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div role="status" className="bg-warning px-4 py-2 text-center text-sm font-medium text-warning-foreground">
      You're offline. Changes can't be saved until your connection comes back.
    </div>
  );
}
