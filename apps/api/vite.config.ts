import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "#api": fileURLToPath(new URL("./src", import.meta.url)),
      "#api-tooling": fileURLToPath(new URL("./tooling", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Workers APIはNode上で動かないため、未指定の利用を失敗させるテスト用入口へ置き換える。
    alias: {
      "cloudflare:workers": fileURLToPath(
        new URL("./src/test/cloudflare-workers.ts", import.meta.url),
      ),
    },
  },
});
