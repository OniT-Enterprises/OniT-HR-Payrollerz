import React from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import { createOptimizedQueryClient } from "@/lib/queryCache";
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

// After a deploy the old hashed chunks are gone; Vite fires this event when a
// dynamic import (or one of its preloaded deps) fails to fetch. Reload once
// (shared once-per-minute guard with lazyWithRetry in routes.tsx) to pick up
// the fresh index.html instead of stranding the user on a dead page.
window.addEventListener("vite:preloadError", (event) => {
  const KEY = "meza-chunk-reload-at";
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last > 60_000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    event.preventDefault(); // suppress the throw; we're reloading
    window.location.reload();
  }
});

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

// Create QueryClient and render immediately. AuthProvider hydrates the small,
// user-scoped safe cache only after Firebase identity is resolved.
const queryClient = createOptimizedQueryClient();

root.render(<App queryClient={queryClient} />);

// Prefetch common routes after browser is idle
prefetchCommonRoutesOnIdle();

// Register service worker after page load (don't block render)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — app works fine without it
    });
  });
}
