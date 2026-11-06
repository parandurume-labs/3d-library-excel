import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next.js compiles JSX with the automatic runtime, so components need no React import.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    coverage: { reporter: ["text", "json"] },
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
