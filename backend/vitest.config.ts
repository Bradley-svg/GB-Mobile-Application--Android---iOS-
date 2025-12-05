import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    setupFiles: ['test/vitest.setup.ts'],
    hookTimeout: 30000,
    maxConcurrency: 1,
    coverage: {
      provider: 'v8',
    },
  },
});
