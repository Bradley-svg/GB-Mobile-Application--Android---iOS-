import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    testTimeout: 10_000,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: [...configDefaults.exclude, "e2e/**/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: [
        ".next/**",
        "tests/**/*",
        "next-env.d.ts",
        "next.config.*",
        "postcss.config.*",
        "tailwind.config.*",
        "eslint.config.*",
        "vitest.config.*",
      ],
      thresholds: {
        statements: 36,
        branches: 29,
        functions: 33,
        lines: 36,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "@greenbro/ui-tokens": path.resolve(__dirname, "../packages/ui-tokens/src"),
    },
  },
});
