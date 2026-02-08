import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
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
    // SEC-4: Drop console.log and console.warn in production builds to prevent PII leaks
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
    },
  },
});
