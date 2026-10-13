import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// 共有クライアントを単独でも検証できるよう、所有するsrcとsetupだけでブラウザー相当のテストを構成する。
export default defineConfig({
  fmt: { printWidth: 100 },
  plugins: [react()],
  resolve: { alias: { "#client": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.tsx"],
  },
});
