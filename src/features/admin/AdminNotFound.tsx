import { Link } from "react-router-dom";

export function AdminNotFound() {
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-6 text-surface-foreground shadow-surface">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="text-sm text-muted">That staff page doesn't exist.</p>
      <Link to="/admin" className="text-sm font-medium text-accent hover:underline">
        Go to the dashboard
      </Link>
    </div>
  );
}
