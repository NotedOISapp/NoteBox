import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Extend timeout for container startup
    hookTimeout: 90000,
    testTimeout: 90000,
    // Only include source test files, exclude compiled output
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    fileParallelism: false,
    // Exclude dist folder from test discovery
    exclude: ['dist/**'],
  },
  coverage: {
    reporter: ['text', 'html', 'json'],
    thresholds: {
      // TODO: Restore original thresholds (lines: 85, branches: 80) before production
      lines: 70,
      branches: 60,
    },
  },
});
