import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

// 切り出したリポジトリでも隣接テストを実行できるよう、このアプリ内のaliasとsetupで完結させる。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "#web": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/*.stories.{ts,tsx}"],
  },
});
