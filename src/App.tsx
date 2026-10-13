import { BrowserRouter } from "react-router-dom";
import { OfflineBanner } from "./components/ui/OfflineBanner";
import { Toaster } from "./components/ui/Toast";
import { AuthProvider } from "./features/auth/AuthProvider";
import { useAuth } from "./features/auth/useAuth";
import { AppRoutes } from "./router";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, error, retry } = useAuth();

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
        <p className="mb-3 text-sm text-red-600">Couldn't sign you in: {error}</p>
        <button
          type="button"
          onClick={retry}
          className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="h-4 w-1/3 animate-pulse rounded-md bg-slate-200" />
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-slate-200" />
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OfflineBanner />
        <AuthGate>
          <AppRoutes />
        </AuthGate>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
