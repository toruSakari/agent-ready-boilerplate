import { selectExportFiles, copyDependencyPatches } from "@/tooling/export-repository.mjs";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vite-plus/test";

const temporaryDirectories: string[] = [];

function repository(files: string[]) {
  const root = mkdtempSync(join(tmpdir(), "repository-export-"));
  temporaryDirectories.push(root);
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), "fixture");
  }

  return root;
}

// 実際のgit ls-filesと同じNUL区切りにし、改行を含むファイル名も一項目として検証する。
function gitFileList(files: string[]) {
  return files.join("\0") + "\0";
}

afterEach(() => {
  for (const root of temporaryDirectories.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("切り出したアプリにもセキュリティパッチをコピーし、リンクは含めない", () => {
  const root = repository(["patches/braces@3.0.3.patch", "patches/private.txt"]);
  const destination = repository([]);
  symlinkSync(join(root, "patches/private.txt"), join(root, "patches/link.patch"));
  copyDependencyPatches(destination, root);
  expect(readFileSync(join(destination, "patches/braces@3.0.3.patch"), "utf8")).toBe("fixture");
  expect(() => readFileSync(join(destination, "patches/private.txt"))).toThrow();
  expect(() => readFileSync(join(destination, "patches/link.patch"))).toThrow();
});

it("独立アプリ用リポジトリの出力 / 選択した画面のルート・固有機能・テストを保持し、ルートのStorybookファイルを除外する", () => {
  const included = [
    "apps/business/package.json",
    "apps/business/app/products/page.tsx",
    "apps/business/src/entities/product/index.ts",
    "apps/business/src/entities/product/ui/product-image.test.tsx",
  ];
  const excluded = [
    "apps/business/src/entities/product/ui/product-image.stories.tsx",
    "apps/business/src/entities/product/ui/product-card.stories.ts",
    "apps/admin/src/widgets/admin-access-console/index.ts",
    "apps/web/src/features/register-customer/index.ts",
    ".storybook/fixtures.tsx",
    "packages/client/src/entities/order/index.ts",
  ];
  const files = [...included, ...excluded];
  expect(selectExportFiles("business", gitFileList(files), repository(files))).toEqual(included);
});

it.each(["web", "business", "admin"] as const)(
  "独立アプリ用リポジトリの出力 / 対応する全ソース形式で%sのstoryを除外する",
  (app) => {
    const files = ["ts", "tsx", "js", "jsx", "mts", "mjs", "cts", "cjs"].map(
      (extension) => `apps/${app}/src/example.stories.${extension}`,
    );
    expect(selectExportFiles(app, gitFileList(files), repository(files))).toEqual([]);
  },
);

it("独立アプリ用リポジトリの出力 / 独立検証に必要なAPIソースと同じ階層のテストを保持する", () => {
  const files = [
    "apps/api/src/presentation/access/routes.ts",
    "apps/api/src/presentation/access/routes.test.ts",
  ];
  expect(selectExportFiles("api", gitFileList(files), repository(files))).toEqual(files);
});

it("独立アプリ用リポジトリの出力 / ステージ済み・未追跡パスの重複を除き、削除済みの追跡ファイルを除外する", () => {
  const source = "apps/business/src/entities/product/index.ts";
  const root = repository([source]);
  const files = [source, "apps/business/src/deleted.ts", source];
  expect(selectExportFiles("business", gitFileList(files), root)).toEqual([source]);
  expect(selectExportFiles("business", "", root)).toEqual([]);
});

it("独立アプリ用リポジトリの出力 / ファイル名の空白・改行・非ASCII文字を維持する", () => {
  const files = ["apps/web/src/name with spaces.ts", "apps/web/src/複数\n行.ts"];
  expect(selectExportFiles("web", gitFileList(files), repository(files))).toEqual(files);
});

it("独立アプリ用リポジトリの出力 / 認証情報を除外し、明示的な設定サンプルを保持する", () => {
  const included = ["apps/admin/.env.example", "apps/admin/.dev.vars.example"];
  const excluded = [
    "apps/admin/.env",
    "apps/admin/.env.local",
    "apps/admin/.env.production",
    "apps/admin/.dev.vars",
    "apps/admin/.dev.vars.production",
    "apps/admin/nested/.env.secret",
  ];
  const files = [...included, ...excluded];
  expect(selectExportFiles("admin", gitFileList(files), repository(files))).toEqual(included);
});

it("独立アプリ用リポジトリの出力 / ディレクトリ・リンク・アプリ外のパスをコピーしない", () => {
  const root = repository(["apps/web/src/feature.ts", ".env", "outside.ts"]);
  // 選んだアプリ内に見えるパスでも、リンク先の秘密情報や外部ファイルは出力させない。
  symlinkSync(join(root, ".env"), join(root, "apps/web/src/linked.ts"));
  symlinkSync(root, join(root, "apps/web/src/linked-directory"));
  const files = [
    "apps/web/src",
    "apps/web/src/linked.ts",
    "apps/web/src/linked-directory/outside.ts",
    "apps/web/../../.env",
  ];
  expect(selectExportFiles("web", gitFileList(files), root)).toEqual([]);
});

it.each(["web", "business", "admin"] as const)(
  "独立アプリ用リポジトリの出力 / %sのパッケージimportマップをテスト・storyから独立させる",
  (app) => {
    const pkg: { imports: Record<string, string> } = JSON.parse(
      readFileSync(`apps/${app}/package.json`, "utf8"),
    );
    expect(Object.keys(pkg.imports).some((key) => key.startsWith(`#${app}/`))).toBe(true);
    for (const [key, target] of Object.entries(pkg.imports)) {
      expect(key).not.toMatch(/\.(?:stories|test)(?:\.|$)/);
      expect(target).not.toMatch(/\.(?:stories|test)(?:\.|$)/);
      expect(target).not.toContain("../");
      expect(target).not.toContain(".storybook");
    }
  },
);
