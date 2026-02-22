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
    // SEC-4: Strip console.log/warn in production to prevent PII leaks
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React runtime
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/react-router")) {
            return "vendor-router";
          }
          // Firebase SDK
          if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) {
            return "vendor-firebase";
          }
          // UI components (Radix)
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-ui";
          }
          // Data management
          if (id.includes("node_modules/@tanstack")) {
            return "vendor-data";
          }
          // Charts - let Vite handle recharts/d3 to avoid circular dependency issues
          // Manual chunking can break d3's module initialization order
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
