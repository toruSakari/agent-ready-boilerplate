import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";

const config: StorybookConfig = {
  // 実装に隣接したstoryを集め、移動時に画面と検証例が別々にならないようにする。
  stories: [
    "../packages/ui/src/**/*.stories.tsx",
    "../packages/client/src/**/*.stories.tsx",
    "../apps/*/src/**/*.stories.tsx",
  ],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {
      // 通常アプリのCloudflare/TanStack Start設定を読み込まず、Story専用の通信mockで構築する。
      builder: { viteConfigPath: fileURLToPath(new URL("./vite.config.ts", import.meta.url)) },
    },
  },
  core: { disableTelemetry: true },
  // builderがvite.configのbuild設定を除くため、最終設定でSDKのchunkを分ける。
  viteFinal: async (config) => {
    const { mergeConfig } = await import("vite");
    return mergeConfig(config, {
      // Storyの初期iframeへ認証・フォーム・ルーターのSDKを集中させない。
      build: {
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [
                {
                  name: "react",
                  test: /node_modules\/(?:react|react-dom|scheduler)\//,
                  includeDependenciesRecursively: false,
                },
                {
                  name: "clerk",
                  test: /node_modules\/@clerk\//,
                  includeDependenciesRecursively: false,
                },
                {
                  name: "tanstack",
                  test: /node_modules\/@tanstack\//,
                  includeDependenciesRecursively: false,
                },
                {
                  name: "forms",
                  test: /node_modules\/(?:zod|react-hook-form|@hookform\/resolvers)\//,
                  includeDependenciesRecursively: false,
                },
              ],
            },
          },
        },
      },
    });
  },
};
export default config;
