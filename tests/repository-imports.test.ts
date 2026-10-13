import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it } from "vite-plus/test";

const apps = ["api", "web", "business", "admin"] as const;
const importSpecifier = /["'`](#(?:api-tooling|api|web|business|admin|app)\/[^"'`\s]+)["'`]/g;

function sourceImports(directory: string, recursive = true): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return recursive ? sourceImports(path) : [];
    }

    if (!/\.[cm]?[jt]sx?$/.test(entry.name)) {
      return [];
    }

    return [...readFileSync(path, "utf8").matchAll(importSpecifier)].map((match) => match[1]);
  });
}

it.each(apps)(
  "サービスのパッケージimport / %sのimportsはワイルドカードをそのまま使い、ファイルごとの上書きを作らない",
  (app) => {
    const pkg = JSON.parse(readFileSync(`apps/${app}/package.json`, "utf8"));
    expect(pkg.imports).toEqual(
      app === "api"
        ? { "#api/*": "./src/*", "#api-tooling/*": "./tooling/*" }
        : { "#app/*": "./app/*", [`#${app}/*`]: "./src/*" },
    );
  },
);

it.each(apps)(
  "サービスのパッケージimport / %sの全ソースimportをNode標準のパッケージimportsで解決する",
  (app) => {
    const root = resolve(`apps/${app}`);
    const imports = [
      ...sourceImports(root, false),
      ...sourceImports(join(root, "src")),
      ...sourceImports(join(root, app === "api" ? "tooling" : "app")),
    ];
    const specifiers = [...new Set(imports)];
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier).toMatch(/\.(?:ts|tsx|mjs|js|css)$/);
    }

    // Vite・TypeScriptのパス補助なしで、Nodeが実ファイルへ解決できることを確認する。
    // TSXはここでは解決だけを扱い、変換は画面・Storybookのbuildで検証する。
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { readFileSync, statSync } from 'node:fs';
         import { fileURLToPath } from 'node:url';
         const specifiers = JSON.parse(readFileSync(0, 'utf8'));
         console.log(JSON.stringify(specifiers.map(specifier => {
           const file = fileURLToPath(import.meta.resolve(specifier));
           if (!statSync(file).isFile()) throw new Error(specifier);
           return file;
         })));`,
      ],
      { cwd: root, input: JSON.stringify(specifiers), encoding: "utf8" },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      specifiers.map((specifier) => {
        const [alias, ...segments] = specifier.split("/");
        let directory;
        if (alias === "#app") {
          directory = "app";
        } else {
          if (alias === "#api-tooling") {
            directory = "tooling";
          } else {
            directory = "src";
          }
        }

        return join(root, directory, ...segments);
      }),
    );
  },
);

it("サービスのパッケージimport / APIのTypeScriptと移行ガードをNodeで直接読み込める", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `await import('#api/domain/access/value-objects/permission.ts');
         await import('#api-tooling/service-account-migration-guard.ts');`,
    ],
    { cwd: resolve("apps/api"), encoding: "utf8" },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
});
