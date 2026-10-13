import { Link } from "react-router-dom";

export function AdminNotFound() {
  return (
    <div className="px-4 py-16 text-center">
      <h1 className="mb-2 text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="mb-4 text-sm text-slate-500">That staff page doesn't exist.</p>
      <Link to="/admin" className="text-sm font-medium text-indigo-600 underline">
        Go to the dashboard
      </Link>
    </div>
  );
}
