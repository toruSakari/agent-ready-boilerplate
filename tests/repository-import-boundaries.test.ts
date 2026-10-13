import plugin from "@/lint/no-relative-imports.ts";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

// ルールIDや検証用コードは変えず、RuleTesterが生成する表示名だけを日本語にする。
RuleTester.describe = (name, run) => {
  const labels: Record<string, string> = {
    valid: "許可されるimport",
    invalid: "拒否されるimport",
  };
  return describe(labels[name] ?? `リポジトリのimport境界（${name}）`, run);
};
RuleTester.it = (name, run) => it(`import境界を検証する: ${name}`, run);
RuleTester.itOnly = (name, run) => it.only(`import境界を検証する: ${name}`, run);

const tester = new RuleTester({ cwd: "/repository" });
const appNames = ["api", "web", "business", "admin"];
// importだけでなく再公開・型参照・requireも並べ、別構文で所有境界を迂回できないか確認する。
const importForms = [
  (source: string) => `import { value } from "${source}";`,
  (source: string) => `import "${source}";`,
  (source: string) => `export { value } from "${source}";`,
  (source: string) => `export * from "${source}";`,
  (source: string) => `const module = import("${source}");`,
  (source: string) => `const module = import(\`${source}\`);`,
  (source: string) => `type Value = import("${source}").Value;`,
  (source: string) => `import module = require("${source}");`,
  (source: string) => `const module = require("${source}");`,
];

tester.run("project/no-relative-imports", plugin.rules["no-relative-imports"], {
  valid: [
    ...appNames.map((app) => ({
      filename: `apps/${app}/src/example.ts`,
      code: `import { value } from "#${app}/entities/example";`,
    })),
    ...["web", "business", "admin"].map((app) => ({
      filename: `apps/${app}/app/layout.tsx`,
      code: 'import "#app/globals.css";',
    })),
    ...["apps/business/src/example.tsx", "packages/ui/src/example.tsx"].map((filename) => ({
      filename,
      code: 'import { Order } from "@dev-template/client/entities/order";',
    })),
    ...["apps/business/src/product.stories.tsx", "packages/client/src/order.stories.tsx"].map(
      (filename) => ({ filename, code: 'import { fixtures } from "#storybook/fixtures";' }),
    ),
    ...["tests/contracts.test.ts", ".storybook/fixtures.tsx", "tooling/check.ts"].map(
      (filename) => ({
        filename,
        code: [
          "#api/contracts",
          "#web/features/example",
          "#business/entities/product/index.ts",
          "#admin/widgets/access",
          "#client/shared/api",
          "#storybook/fixtures",
          "@/packages/ui/src/button",
        ]
          .map((source) => `import "${source}";`)
          .join("\n"),
      }),
    ),
    {
      filename: "packages/client/src/example.ts",
      code: 'export { value } from "#client/entities/order"; export const own = true;',
    },
    {
      filename: "apps/api/tooling/example.ts",
      code: 'import { value } from "#api-tooling/shared";',
    },
    {
      filename: "apps/web/src/example.ts",
      code: "const source = 'external-package'; const module = import(source);",
    },
  ],
  invalid: [
    ...appNames.flatMap((app) =>
      appNames
        .filter((other) => other !== app)
        .map((other) => ({
          filename: `apps/${app}/src/example.ts`,
          code: `import { value } from "#${other}/entities/example";`,
          errors: [{ messageId: "repositoryImport" }],
        })),
    ),
    ...["client", "ui", "config", "api-types"].flatMap((pkg) =>
      [...appNames.map((app) => `#${app}/example`), "#app/globals.css", "#api-tooling/shared"].map(
        (source) => ({
          filename: `packages/${pkg}/src/example.ts`,
          code: importForms[0](source),
          errors: [{ messageId: "repositoryImport" }],
        }),
      ),
    ),
    ...importForms.flatMap((code) => [
      {
        filename: "apps/business/src/example.ts",
        code: code("#admin/widgets/access"),
        errors: [{ messageId: "repositoryImport" }],
      },
      {
        filename: "packages/client/src/example.ts",
        code: code("@/apps/business/src/entities/product"),
        errors: [{ messageId: "repositoryImport" }],
      },
      {
        filename: "tests/example.test.ts",
        code: code("../packages/client/src/entities/order"),
        errors: [{ messageId: "relativeImport" }],
      },
    ]),
    ...[
      "apps/web/src/example.ts",
      "apps/business/src/example.test.tsx",
      "apps/admin/src/example.stories.tsx",
      "packages/ui/src/example.tsx",
    ].map((filename) => ({
      filename,
      code: 'import { value } from "#client/shared/api/trpc";',
      errors: [{ messageId: "repositoryImport" }],
    })),
    ...[
      "apps/web/src/example.tsx",
      "apps/business/src/example.test.tsx",
      "packages/client/src/example.tsx",
      "packages/ui/src/example.stories-helper.tsx",
    ].map((filename) => ({
      filename,
      code: 'import { fixtures } from "#storybook/fixtures";',
      errors: [{ messageId: "storybookImport" }],
    })),
    {
      filename: "apps/admin/src/example.stories.tsx",
      code: 'import { fixtures } from "#storybook/mocks/authenticated-fetch";',
      errors: [{ messageId: "storybookImport" }],
    },
    {
      filename: "apps/web/src/example.tsx",
      code: 'import { value } from "/repository/apps/admin/src/example";',
      errors: [{ messageId: "repositoryImport" }],
    },
    ...["apps/web/src/example.tsx", "packages/client/src/example.tsx"].map((filename) => ({
      filename,
      code: 'export { value } from "@dev-template/business/src/example";',
      errors: [{ messageId: "repositoryImport" }],
    })),
    {
      filename: "C:\\repository\\apps\\business\\src\\example.ts",
      code: 'import { value } from "#web/features/example";',
      errors: [{ messageId: "repositoryImport" }],
    },
  ],
});
