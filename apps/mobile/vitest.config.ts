import { defineConfig } from 'vitest/config';
import path from 'path';
import { mobileTestIncludes } from './test-suites.mjs';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: mobileTestIncludes,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
