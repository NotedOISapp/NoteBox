import { defineConfig } from 'vitest/config';
import { unitTestIncludes } from './test-suites.mjs';

export default defineConfig({
  test: {
    environment: 'node',
    include: unitTestIncludes,
    exclude: ['node_modules/**'],
  },
});
