/**
 * E2E configuration — drives the real SPA against the Firebase emulator
 * suite running the PRODUCTION firestore.rules + storage.rules
 * (firebase.e2e.json), so rules-enforced behavior (two-person payroll
 * approval, subscription paywall, tenant isolation) is exercised, not mocked.
 *
 * Run: npm run e2e   (starts emulators + vite dev automatically)
 */
import { defineConfig } from "@playwright/test";

// Keep the browser suite off 8081: that is the default React Native / Expo
// development port and is commonly occupied on a product developer's laptop.
// Rules-only tests keep their existing firebase.dev.json port.
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8181";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // One worker: the spec is a single serial user journey on shared emulators.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  use: {
    // Dedicated port: the regular dev server on 8080 talks to PRODUCTION
    // Firebase — E2E must never reuse it. 8090 only ever hosts the
    // emulator-wired instance started below.
    baseURL: "http://localhost:8090",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      // The PATH prefix keeps the Firestore emulator on Java 21 on this
      // machine (harmless where the directory doesn't exist, e.g. CI).
      // functions is required: the payroll approval writes its audit trail
      // through the recordTenantAuditEvent callable.
      command:
        'PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" firebase emulators:start --config firebase.e2e.json --project onit-hr-payroll --only auth,firestore,storage,functions',
      // Probe the emulator HUB — an individual emulator port can answer from
      // a stale partial stack and mask a missing auth/functions emulator.
      url: "http://localhost:4400",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      // Firebase traps Ctrl+C and stops its Java emulator children. Playwright's
      // default SIGKILL can strand Firestore on :8181, making the next local run
      // fail before any test starts.
      gracefulShutdown: { signal: "SIGINT", timeout: 10_000 },
      stdout: "ignore",
    },
    {
      command: "npm run dev -- --port 8090 --strictPort",
      url: "http://localhost:8090",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_USE_EMULATORS: "true",
        VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: "8181",
      },
      stdout: "ignore",
    },
  ],
});
