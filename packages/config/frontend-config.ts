import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";
import { defineConfig, loadEnv } from "vite-plus";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_INSPECTOR_PORTS = Object.freeze({ web: 9230, business: 9231, admin: 9232 });
// ブラウザーの初期chunkにUI・認証・フォームのSDKを集中させず、共有vendorを個別にキャッシュする。
const clientEnvironments = {
  client: {
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
                name: "query",
                test: /node_modules\/@tanstack\/(?:react-query|query-core)\//,
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
  },
};

/** 各アプリのルート接続とFSDを維持し、Start・Cloudflareの技術設定を共有する。 */
export function frontendConfig(name: "web" | "business" | "admin", configUrl: string) {
  const appRoot = dirname(fileURLToPath(configUrl));
  return defineConfig((props) => {
    const publicEnvironment = loadEnv(props.mode, appRoot, "NEXT_PUBLIC_");
    return {
      root: appRoot,
      resolve: { alias: { [`#${name}`]: `${appRoot}/src`, "#app": `${appRoot}/app` } },
      define: Object.fromEntries(
        [
          "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
          "NEXT_PUBLIC_CUSTOMER_ORIGIN",
          "NEXT_PUBLIC_BUSINESS_ORIGIN",
        ].map((key) => [
          `process.env.${key}`,
          JSON.stringify((process.env[key] ?? publicEnvironment[key])?.trim() || undefined) ??
            "undefined",
        ]),
      ),
      css: { postcss: { plugins: [tailwindcss()] } },
      environments: clientEnvironments,
      plugins: frontendPlugins(name, appRoot),
    };
  });
}

function frontendPlugins(name: keyof typeof FRONTEND_INSPECTOR_PORTS, appRoot: string) {
  return [
    cloudflare({
      configPath: `${appRoot}/wrangler.jsonc`,
      inspectorPort: FRONTEND_INSPECTOR_PORTS[name],
      viteEnvironment: { name: "ssr" },
    }),
    // アプリ名のroute groupでルート型を分離し、URLにはgroup名を含めない。
    tanstackStart({
      srcDirectory: "app",
      router: {
        // ページはURLフォルダーのroute.ts、子を包むガードはlayout.tsへコロケーションする。
        indexToken: "route",
        routeToken: "layout",
        quoteStyle: "double",
        semicolons: true,
        addExtensions: true,
        routeTreeFileHeader: [
          "// @ts-nocheck",
          "// TanStack Routerが自動生成するルート接続。直接編集しない。",
        ],
      },
      server: { entry: "../worker-entry.ts" },
    }),
    react(),
  ];
}
