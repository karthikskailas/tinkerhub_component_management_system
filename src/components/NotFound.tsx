import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-transparent sm:px-4">
      <div className="flex w-full max-w-lg flex-col items-center gap-2 p-8 text-center sm:rounded-3xl sm:bg-surface sm:shadow-surface">
        <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
        <p className="text-sm text-muted">The page you're looking for doesn't exist.</p>
        <Link to="/" className="mt-2 text-sm font-medium text-accent hover:underline">
          Go home
        </Link>
      </div>
    </div>
  );
}
