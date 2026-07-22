import { defineConfig } from 'vitest/config';
import { integrationTestIncludes } from './test-suites.mjs';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    include: integrationTestIncludes,
    fileParallelism: false,
    maxWorkers: 1,
    isolate: true,
    hookTimeout: 120000,
    testTimeout: 30000,
  },
});
