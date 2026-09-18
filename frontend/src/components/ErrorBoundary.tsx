import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Without this, any uncaught render-time error in any page white-screens the
// entire SPA with no way to recover except a manual refresh. One boundary at
// the root is enough to catch that and offer a way back instead of a blank tab.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-bg flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-xl font-semibold text-brand-text">Something went wrong</h1>
          <p className="text-sm text-brand-muted">Please refresh the page and try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark"
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
