import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    setupFiles: ['test/vitest.setup.ts'],
    hookTimeout: 30000,
    fileParallelism: false,
    maxConcurrency: 1,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      provider: 'v8',
      reports: ['text', 'lcov'],
      // TODO: tighten once baseline is recorded in CI; target 80%+ if feasible.
      thresholds: {
        statements: 75,
        branches: 65,
        functions: 70,
        lines: 75,
      },
    },
  },
});
