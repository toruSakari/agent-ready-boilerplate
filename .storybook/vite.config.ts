import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "#web", replacement: fileURLToPath(new URL("../apps/web/src", import.meta.url)) },
      {
        find: "#business",
        replacement: fileURLToPath(new URL("../apps/business/src", import.meta.url)),
      },
      { find: "#admin", replacement: fileURLToPath(new URL("../apps/admin/src", import.meta.url)) },
      { find: "#storybook", replacement: fileURLToPath(new URL("./", import.meta.url)) },
      // 詳細な通信mockを先に解決し、後続の#client全体のエイリアスに飲み込ませない。
      {
        find: "#client/shared/api/authenticated-fetch",
        replacement: fileURLToPath(new URL("./mocks/authenticated-fetch.tsx", import.meta.url)),
      },
      {
        find: "#client",
        replacement: fileURLToPath(new URL("../packages/client/src", import.meta.url)),
      },
      { find: "@", replacement: fileURLToPath(new URL("../", import.meta.url)) },
    ],
    dedupe: ["react", "react-dom"],
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  // アプリの環境ファイルを読まず、Storybookへ秘密情報や実認証の設定を持ち込まない。
  envDir: false,
  envPrefix: "STORYBOOK_",
  define: {
    "process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_CUSTOMER_ORIGIN": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_BUSINESS_ORIGIN": JSON.stringify(""),
  },
});
