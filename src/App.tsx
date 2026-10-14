import { Spinner } from "@heroui/react";
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
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-danger">
          We couldn't start your session. Check your connection and try again.
        </p>
        {/* Native button on purpose: importing the HeroUI Button here would pull it
            into the entry chunk (+37 kB) for a rarely shown error state. */}
        <button
          type="button"
          onClick={retry}
          className="min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner size="lg" />
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
