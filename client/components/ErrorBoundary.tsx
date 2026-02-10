import React from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw, BarChart3, FileSpreadsheet, Table } from 'lucide-react';

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
      setTimeout(() => {
        this.setState({ hasError: false, error: null });
      }, 100);
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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              An error occurred while rendering the application.
            </p>
            <button
              onClick={this.reset}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================
// GRANULAR ERROR FALLBACKS
// ============================================

interface FallbackProps {
  error: Error | null;
  reset: () => void;
}

/** Simple inline error fallback */
export const SimpleErrorFallback: React.FC<FallbackProps> = ({ error, reset }) => (
  <div className="p-4 border border-red-200 bg-red-50 rounded">
    <div className="flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
      <div className="flex-1">
        <h3 className="text-red-800 font-medium">Error occurred</h3>
        <p className="text-red-600 text-sm mt-1">
          {error?.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          className="mt-3 inline-flex items-center gap-1 text-sm text-red-700 hover:text-red-800 font-medium"
        >
          <RefreshCw className="h-3 w-3" />
          Try again
        </button>
      </div>
    </div>
  </div>
);

/** Chart-specific error fallback */
export const ChartErrorFallback: React.FC<FallbackProps> = ({ error, reset }) => (
  <div className="h-full min-h-[200px] flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-lg">
    <BarChart3 className="h-10 w-10 text-slate-400 mb-3" />
    <h3 className="text-slate-700 font-medium">Unable to render chart</h3>
    <p className="text-slate-500 text-sm mt-1 text-center max-w-xs">
      {error?.message || 'There was a problem displaying this chart.'}
    </p>
    <button
      onClick={reset}
      className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
    >
      <RefreshCw className="h-3 w-3" />
      Retry
    </button>
  </div>
);

/** CSV/File import error fallback */
export const ImportErrorFallback: React.FC<FallbackProps> = ({ error, reset }) => (
  <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg">
    <div className="flex items-start gap-3">
      <FileSpreadsheet className="h-6 w-6 text-amber-600 mt-0.5 shrink-0" />
      <div className="flex-1">
        <h3 className="text-amber-800 font-medium">Import Error</h3>
        <p className="text-amber-700 text-sm mt-1">
          {error?.message || 'Failed to process the imported file. Please check the file format and try again.'}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-800 bg-amber-100 rounded hover:bg-amber-200"
          >
            <RefreshCw className="h-3 w-3" />
            Try again
          </button>
        </div>
      </div>
    </div>
  </div>
);

/** Table/data grid error fallback */
export const TableErrorFallback: React.FC<FallbackProps> = ({ error, reset }) => (
  <div className="p-6 border border-slate-200 rounded-lg bg-slate-50">
    <div className="flex items-start gap-3">
      <Table className="h-6 w-6 text-slate-500 mt-0.5 shrink-0" />
      <div className="flex-1">
        <h3 className="text-slate-700 font-medium">Unable to display data</h3>
        <p className="text-slate-500 text-sm mt-1">
          {error?.message || 'There was a problem loading or displaying this data.'}
        </p>
        <button
          onClick={reset}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    </div>
  </div>
);

/** Compact error fallback for cards/widgets */
export const CompactErrorFallback: React.FC<FallbackProps> = ({ reset }) => (
  <div className="flex items-center justify-center p-4 bg-red-50 rounded text-sm text-red-600">
    <AlertTriangle className="h-4 w-4 mr-2" />
    <span>Error loading</span>
    <button
      onClick={reset}
      className="ml-2 underline hover:no-underline"
    >
      Retry
    </button>
  </div>
);

// ============================================
// CONVENIENCE WRAPPERS
// ============================================

/** Error boundary for chart components */
export const ChartErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary fallback={ChartErrorFallback}>{children}</ErrorBoundary>
);

/** Error boundary for CSV/file import components */
export const ImportErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary fallback={ImportErrorFallback}>{children}</ErrorBoundary>
);

/** Error boundary for data tables */
export const TableErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary fallback={TableErrorFallback}>{children}</ErrorBoundary>
);

/** Error boundary for cards/widgets */
export const WidgetErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary fallback={CompactErrorFallback}>{children}</ErrorBoundary>
);
