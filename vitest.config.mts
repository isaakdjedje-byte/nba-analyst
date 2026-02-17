import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: [
      "e2e/**",
      "tests/e2e/**",
      "tests/api/**",
      "tests/auth/**",
      "tests/visual/**",
      "tests/component/**",
      "tests/story-1-1/**",
      "tests/ingestion/**",
      "tests/integration/**",
      "src/__tests__/rgpd/**",
      "src/__tests__/cache/cache-integration.test.ts",
      "playwright-report/**",
      "test-results/**",
      ".opencode/**",
      "node_modules/**",
      "dist/**",
      ".next/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
