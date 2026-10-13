import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // ルート検証は全workspaceを接続する。アプリ本体の依存境界はlintと契約テストで別途守る。
    alias: {
      "#api-tooling": fileURLToPath(new URL("./apps/api/tooling", import.meta.url)),
      "#api": fileURLToPath(new URL("./apps/api/src", import.meta.url)),
      "#web": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
      "#business": fileURLToPath(new URL("./apps/business/src", import.meta.url)),
      "#admin": fileURLToPath(new URL("./apps/admin/src", import.meta.url)),
      "#storybook": fileURLToPath(new URL("./.storybook", import.meta.url)),
      "#client": fileURLToPath(new URL("./packages/client/src", import.meta.url)),
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  fmt: {
    printWidth: 100,
    objectWrap: "preserve",
    endOfLine: "lf",
    insertFinalNewline: true,
    ignorePatterns: ["**/routeTree.gen.ts"],
  },
  lint: {
    jsPlugins: ["./lint/no-relative-imports.ts"],
    plugins: ["typescript", "react", "import"],
    rules: {
      // 保守性の見直し目安。行数だけを理由に凝集した処理を分割しない。
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 50, skipBlankLines: true, skipComments: true }],
      complexity: ["warn", 10],
      "max-depth": ["error", 3],
      "max-classes-per-file": ["error", { max: 1, ignoreExpressions: false }],
      "max-nested-callbacks": ["error", 2],
      "no-nested-ternary": "error",
      curly: ["error", "all"],
      "array-callback-return": "error",
      "no-async-promise-executor": "error",
      "no-fallthrough": "error",
      "no-useless-catch": "error",
      "no-useless-return": "error",
      "prefer-const": "error",
      "no-unneeded-ternary": ["error", { defaultAssignment: false }],
      "import/first": "error",
      "import/no-duplicates": "error",
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
      "project/no-destructured-parameters": "error",
      "project/readable-spacing": "error",
      "project/application-roles": "error",
      "project/repository-responsibilities": "error",
      "project/no-relative-imports": "error",
      "project/one-component-per-file": "error",
      "project/single-value-object": "error",
      "project/entity-class": "error",
      "project/branded-dto": "error",
      "project/one-value-object-per-file": "error",
      "project/one-dto-per-file": "error",
    },
    overrides: [
      {
        files: ["**/*.tsx"],
        rules: {
          "max-lines-per-function": "off",
          "project/react-function-lines": "warn",
        },
      },
      {
        files: ["**/*.test.{ts,tsx,js,mjs}", "**/*.spec.{ts,tsx,js,mjs}"],
        rules: {
          "max-lines": ["warn", { max: 600, skipBlankLines: true, skipComments: true }],
          // describe・itの二段を含め、テスト内部の実処理は本番と同じ二段を目安にする。
          "max-nested-callbacks": ["error", 4],
        },
      },
      {
        // API型は生成物。分割は生成元の契約と生成手順で判断する。
        files: ["packages/api-types/index.d.ts"],
        rules: { "max-lines": "off", "project/readable-spacing": "off" },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
      reportUnusedDisableDirectives: "error",
    },
    ignorePatterns: [
      "**/storybook-static/**",
      "**/.next/**",
      "**/.vinext/**",
      "**/.wrangler/**",
      "**/dist/**",
      "**/drizzle/**",
      "**/routeTree.gen.ts",
      "**/worker-configuration.d.ts",
    ],
  },
  test: {
    // 単体テストではWorker bindingをローカルfixtureへ置き換え、実リソースを参照しない。
    alias: {
      "cloudflare:workers": fileURLToPath(
        new URL("./apps/api/src/test/cloudflare-workers.ts", import.meta.url),
      ),
    },
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: [
      "apps/*/src/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
      "packages/**/*.test.{ts,tsx}",
    ],
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
  run: {
    cache: true,
  },
});
