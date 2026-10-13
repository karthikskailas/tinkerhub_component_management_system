import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Shown in the fallback, e.g. "the app" or "the staff dashboard". */
  label: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Never log the error's own message blindly — it can embed request
    // data via component props captured in a thrown value — just the
    // stack/component trace, which is safe and useful for debugging.
    console.error("Unhandled render error:", error.name, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold text-slate-900">Something went wrong</h1>
        <p className="mb-4 text-sm text-slate-500">
          {this.props.label} hit an unexpected error. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white"
        >
          Reload
        </button>
      </div>
    );
  }
}
