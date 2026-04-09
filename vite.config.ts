import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(Date.now().toString(36)),
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/client/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/rules/**', 'tests/functions/**', 'node_modules/**', 'dist/**'],
  },
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    outDir: "dist/spa",
    // Remaining large chunks are opt-in ML/PDF/export features that load on demand.
    // Keep warnings focused on app-shell regressions instead of known lazy bundles.
    chunkSizeWarningLimit: 1400,
    // SEC-4: Strip console.log/warn in production to prevent PII leaks
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("client/i18n/translations.ts")) {
            return "translations";
          }
          // Core React runtime
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/react-router")) {
            return "vendor-react";
          }
          // Heavy export/rendering libraries
          if (id.includes("node_modules/exceljs")) {
            return "vendor-exceljs";
          }
          if (
            id.includes("node_modules/@react-pdf/pdfkit") ||
            id.includes("node_modules/pdfkit") ||
            id.includes("node_modules/fontkit") ||
            id.includes("node_modules/restructure") ||
            id.includes("node_modules/linebreak")
          ) {
            return "vendor-pdfkit";
          }
          if (id.includes("node_modules/@react-pdf")) {
            return "vendor-react-pdf";
          }
          if (id.includes("node_modules/@vladmandic/face-api")) {
            return "vendor-face-api";
          }
          // Firebase SDK split by product to keep the app shell smaller
          if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) {
            if (id.includes("firestore")) {
              return "vendor-firebase-firestore";
            }
            if (id.includes("auth")) {
              return "vendor-firebase-auth";
            }
            if (id.includes("storage")) {
              return "vendor-firebase-storage";
            }
            if (id.includes("functions")) {
              return "vendor-firebase-functions";
            }
            if (id.includes("app-check")) {
              return "vendor-firebase-app-check";
            }
            return "vendor-firebase-core";
          }
          // UI components (Radix) — must be in same chunk as React to avoid
          // forwardRef initialization errors in production builds
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-react";
          }
          // Data management
          if (id.includes("node_modules/@tanstack")) {
            return "vendor-react";
          }
          // Charts - let Vite handle recharts/d3 to avoid circular dependency issues
          // Manual chunking can break d3's module initialization order

          // Group page modules by section — reduces chunk count, speeds up navigation
          // within a module (e.g., clicking between People pages loads no new JS)
          if (id.includes("client/pages/staff/") || id.includes("client/pages/hiring/") || id.includes("client/pages/performance/")) {
            return "pages-people";
          }
          if (id.includes("client/pages/time-leave/")) {
            return "pages-timeleave";
          }
          if (id.includes("client/pages/payroll/")) {
            return "pages-payroll";
          }
          if (id.includes("client/pages/money/")) {
            return "pages-money";
          }
          if (id.includes("client/pages/accounting/")) {
            return "pages-accounting";
          }
          if (id.includes("client/pages/reports/")) {
            return "pages-reports";
          }
        },
      },
    },
  },
  esbuild: {
    // SEC-4: Drop console/debugger in production builds to prevent PII leaks
    // Uses Vite's mode (set by `vite build`) for reliable detection
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
    },
  },
}));
