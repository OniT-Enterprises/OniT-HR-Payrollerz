import React from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import {
  createOptimizedQueryClient,
  hydrateQueryClient,
  setupQueryPersistence,
} from "@/lib/queryCache";
import { prefetchCommonRoutesOnIdle } from "@/lib/prefetch";


// Initialize Sentry for production error tracking
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Only send 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    // Capture 50% of error sessions (limits quota burn on launch spikes)
    replaysOnErrorSampleRate: 0.5,
    replaysSessionSampleRate: 0,
  });
}

// Get the root element
const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

// Check if root already exists to prevent double creation (HMR)
const containerWithRoot = container as HTMLElement & { _reactRoot?: ReturnType<typeof createRoot> };
let root = containerWithRoot._reactRoot;
if (!root) {
  root = createRoot(container);
  containerWithRoot._reactRoot = root;
}

// Create QueryClient and render immediately — don't block on IDB hydration
const queryClient = createOptimizedQueryClient();
setupQueryPersistence(queryClient);

// Render first, hydrate cache in background (data arrives shortly after)
root.render(<App queryClient={queryClient} />);
hydrateQueryClient(queryClient);

// Prefetch common routes after browser is idle
prefetchCommonRoutesOnIdle();
