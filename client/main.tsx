import React from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import { createOptimizedQueryClient } from "@/lib/queryCache";


// Initialize Sentry for production error tracking. Activates the moment the
// VITE_SENTRY_DSN secret exists in the CI build; no-ops otherwise.
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    // Host split: separate the app from the marketing site in triage.
    environment:
      typeof window !== "undefined" &&
      window.location.hostname === "app.xefe.tl"
        ? "production-app"
        : "production-marketing",
    release: import.meta.env.VITE_COMMIT_SHA || undefined,
    // Only send 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    // Most service-layer failures are caught, console.error'd and flattened
    // into a generic toast — capturing console.error is what makes those
    // visible (the "Failed to reject leave request" class).
    integrations: [
      Sentry.captureConsoleIntegration({ levels: ["error"] }),
    ],
    // Session replay stays OFF permanently: screens here carry salaries,
    // identity numbers and payroll history. Masking is not a good enough
    // guarantee for that; stack traces + breadcrumbs are plenty.
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
  });
}

// After a deploy the old hashed chunks are gone; Vite fires this event when a
// dynamic import (or one of its preloaded deps) fails to fetch. Reload once
// (shared once-per-minute guard with lazyWithRetry in routes.tsx) to pick up
// the fresh index.html instead of stranding the user on a dead page.
window.addEventListener("vite:preloadError", (event) => {
  const KEY = "xefe-chunk-reload-at";
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

// Register service worker after page load (don't block render)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — app works fine without it
    });
  });
}
