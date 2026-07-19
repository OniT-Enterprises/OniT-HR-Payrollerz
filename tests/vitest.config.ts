import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Mirror the vite.config.ts build-time define so modules that read it (e.g.
  // client/lib/queryCache.ts) don't throw a ReferenceError under vitest.
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify('test'),
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../client'),
    },
  },
});
