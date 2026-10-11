import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="mb-2 text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="mb-4 text-sm text-slate-500">
        The page you're looking for doesn't exist.
      </p>
      <Link to="/" className="text-sm font-medium text-indigo-600 underline">
        Go home
      </Link>
    </div>
  );
}
