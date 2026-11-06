import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: { reporter: ["text", "json"] },
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
