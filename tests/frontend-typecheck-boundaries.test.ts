// @vitest-environment node
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vite-plus/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve("typescript/package.json")), "bin/tsc");

function programFiles(project: string) {
  const result = spawnSync(process.execPath, [tsc, "--project", project, "--listFilesOnly"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
  return new Set(
    result.stdout
      .trim()
      .split("\n")
      .map((file) => relative(root, file.trim())),
  );
}

it("共通の型検査にアプリ固有のRouter登録やRoute参照を持ち込まない", () => {
  const files = programFiles("tsconfig.json");
  const registeredRoutes = [...files].filter((file) =>
    /^apps\/(web|business|admin)\/app\/(router\.ts|routeTree\.gen\.ts|routes\/.*(?:route|layout)\.ts)$/.test(
      file,
    ),
  );
  expect(registeredRoutes).toEqual([]);
  // Story・FSD・共通テストは引き続き共通programが検査する。
  expect(files.has("tests/api-contract.typecheck.ts")).toBe(true);
  expect(files.has("packages/client/src/widgets/list-filters/model/use-list-search.ts")).toBe(true);
  expect(files.has("packages/client/src/widgets/list-filters/ui/list-filters.stories.tsx")).toBe(
    true,
  );
});

it.each(["web", "business", "admin"])("%sの全ルートと接続を自身の型登録とともに検査する", (app) => {
  const files = programFiles(`apps/${app}/tsconfig.json`);
  const routes = `apps/${app}/app/routes`;
  const sources = readdirSync(resolve(root, routes), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => relative(root, join(entry.parentPath, entry.name)));
  expect(sources.length).toBeGreaterThan(0);
  for (const source of sources) {
    expect(files.has(source), `${source}が${app}の型検査から欠落`).toBe(true);
  }

  expect(files.has(`apps/${app}/app/router.ts`)).toBe(true);
  expect(files.has(`apps/${app}/app/routeTree.gen.ts`)).toBe(true);
  const otherRouters = [...files].filter((file) =>
    /^apps\/(web|business|admin)\/app\/routeTree\.gen\.ts$/.test(file),
  );
  expect(otherRouters).toEqual([`apps/${app}/app/routeTree.gen.ts`]);
});

it("集約typecheckは共通programと3画面・共有client・APIの検査をすべて実行する", () => {
  const manifest: { scripts: { typecheck: string } } = JSON.parse(
    readFileSync(resolve(root, "package.json"), "utf8"),
  );
  const commands = manifest.scripts.typecheck.split(" && ");
  expect(commands).toContain("tsc --noEmit");
  for (const app of ["web", "business", "admin", "client", "api"]) {
    expect(commands).toContain(`pnpm --filter @dev-template/${app} typecheck`);
  }
});
