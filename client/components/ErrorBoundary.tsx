import React from 'react';
import * as Sentry from '@sentry/react';
import { RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error | null; reset: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Report to Sentry
    Sentry.captureException(error, {
      contexts: { react: { componentStack: errorInfo.componentStack } },
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Filter out DOM manipulation errors that are likely safe to ignore
    if (error.message?.includes('removeChild') ||
        error.message?.includes('The node to be removed is not a child')) {
      console.warn('DOM manipulation error caught and handled by ErrorBoundary');
      // Reset the error state after a brief delay
      if (this.resetTimeoutId !== null) {
        window.clearTimeout(this.resetTimeoutId);
      }
      this.resetTimeoutId = window.setTimeout(() => {
        this.setState({ hasError: false, error: null });
        this.resetTimeoutId = null;
      }, 100);
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId !== null) {
      window.clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Render fallback UI or use provided fallback component
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} reset={this.reset} />;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <img
              src="/images/illustrations/error-boundary.webp"
              alt="Something went wrong"
              className="w-48 h-48 mx-auto mb-6 drop-shadow-xl"
            />
            <h2 className="text-2xl font-bold text-foreground mb-3">Something went wrong</h2>
            <p className="text-muted-foreground mb-6">
              An error occurred while rendering the application.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-left">
                <p className="text-sm font-semibold text-destructive mb-2">Development error details</p>
                <p className="text-xs break-words text-foreground/90 mb-3">
                  {this.state.error.message || "Unknown render error"}
                </p>
                {this.state.error.stack && (
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-muted-foreground">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}
            <button
              onClick={this.reset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
