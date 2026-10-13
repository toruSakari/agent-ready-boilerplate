import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

// Gitは新規stageを重複列挙し、削除済み追跡ファイルも返すため、後続で重複と実在を確認する。
// NUL区切りのまま受け取り、空白・改行を含むファイル名を壊さない。
export function selectExportFiles(app, fileList, root = process.cwd()) {
  const prefix = `apps/${app}/`;
  return [...new Set(fileList.split("\0"))].filter((file) => {
    if (!file.startsWith(prefix) || file.split("/").includes("..")) {
      return false;
    }

    if (excludedExportName(basename(file), app)) {
      return false;
    }

    // 削除済みファイルやアプリ外へのリンクを出力に含めず、選んだアプリの範囲を保つ。
    const source = join(root, file);
    return (
      (lstatSync(source, { throwIfNoEntry: false })?.isFile() ?? false) &&
      realpathSync(source).startsWith(resolve(root, prefix) + sep)
    );
  });
}

function excludedExportName(name, app) {
  if ((name === ".env" || name.startsWith(".env.")) && name !== ".env.example") {
    return true;
  }

  if ((name === ".dev.vars" || name.startsWith(".dev.vars.")) && name !== ".dev.vars.example") {
    return true;
  }

  // 画面storyはモノレポ共通fixtureに依存するため、独立リポジトリには持ち出さない。
  return app !== "api" && /\.stories\.[cm]?[jt]sx?$/.test(name);
}

/** 独立した配布物にも依存の修正を含め、patchedDependenciesの参照を維持する。 */
export function copyDependencyPatches(destination, root = process.cwd()) {
  const directory = join(root, "patches");
  if (!existsSync(directory)) {
    return;
  }

  for (const file of readdirSync(directory, { recursive: true })) {
    const source = join(directory, file);
    if (!file.endsWith(".patch") || !lstatSync(source).isFile()) {
      continue;
    }

    const target = join(destination, "patches", file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
}

function command(args) {
  const result = spawnSync("corepack", ["pnpm", ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "パッケージ準備に失敗しました。");
  }
}

function exportRepository() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: "string" } },
  });
  const app = positionals[0];
  if (!["api", "web", "business", "admin"].includes(app) || !values.out) {
    throw new Error("pnpm repository:export api|web|business|admin --out 新しいディレクトリ");
  }

  const destination = resolve(values.out);
  if (existsSync(destination)) {
    throw new Error("出力先が存在します。上書きしないため、新しいディレクトリを指定してください。");
  }

  if (app !== "api") {
    command(["api:types"]);
  }

  copyApplication(app, destination);
  const overrides = packSharedDependencies(app, destination);
  const file = join(destination, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  replaceWorkspaceDependencies(pkg, overrides);
  const root = JSON.parse(readFileSync("package.json", "utf8"));
  pkg.packageManager = root.packageManager;
  pkg.engines = root.engines;
  const workspace = readFileSync("pnpm-workspace.yaml", "utf8")
    .replace(/^packages:\n(?:  -.*\n)+/m, "")
    .replace(
      "overrides:\n",
      "overrides:\n" +
        Object.entries(overrides)
          .map((props) => `  ${JSON.stringify(props[0])}: ${JSON.stringify(props[1])}\n`)
          .join(""),
    );
  copyDependencyPatches(destination);
  writeFileSync(join(destination, "pnpm-workspace.yaml"), workspace);
  writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  writeFileSync(
    join(
      destination,
      existsSync(join(destination, "README.md")) ? "REPOSITORY-EXPORT.md" : "README.md",
    ),
    `# ${pkg.name}\n\n切り出し済みの独立リポジトリです。\n\n\`corepack pnpm install\`、\`corepack pnpm build\`で開始してください。\n共有依存は.artifactsのtarballで固定しています。公開レジストリへ移す場合は通常のバージョン依存へ置き換えます。\n実環境のWorker・Clerk・Access設定と認証情報は個別に設定してください。\n`,
  );
  console.log(`独立した${app}リポジトリを出力しました: ${destination}`);
}

if (import.meta.main) {
  exportRepository();
}

function copyApplication(app, destination) {
  const files = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", `apps/${app}`],
    { encoding: "utf8" },
  );
  if (files.status !== 0) {
    throw new Error("Gitのファイル一覧を取得できませんでした。");
  }

  mkdirSync(destination, { recursive: true });
  for (const file of selectExportFiles(app, files.stdout)) {
    const target = join(destination, file.slice(`apps/${app}/`.length));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(file, target);
  }

  for (const name of [".nvmrc", ".gitignore"]) {
    copyFileSync(name, join(destination, name));
  }
}

function packSharedDependencies(app, destination) {
  // 共有依存をtarballへ固定し、切り出し後に元workspaceへ依存しない形にする。
  const shared = app === "api" ? ["config"] : ["config", "api-types", "ui", "client"];
  const artifactDirectory = join(destination, ".artifacts");
  mkdirSync(artifactDirectory);
  const overrides = {};
  for (const name of shared) {
    command(["--dir", `packages/${name}`, "pack", "--pack-destination", artifactDirectory]);
    const pkg = JSON.parse(readFileSync(`packages/${name}/package.json`, "utf8"));
    overrides[pkg.name] =
      `file:.artifacts/${pkg.name.replace(/^@/, "").replaceAll("/", "-")}-${pkg.version}.tgz`;
  }

  return overrides;
}

function replaceWorkspaceDependencies(pkg, overrides) {
  for (const section of ["dependencies", "devDependencies"]) {
    if (pkg[section]) {
      replaceDependencySection(pkg[section], overrides);
    }
  }
}

function replaceDependencySection(dependencies, overrides) {
  for (const [name, value] of Object.entries(dependencies)) {
    if (!value.startsWith("workspace:")) {
      continue;
    }

    if (!overrides[name]) {
      throw new Error(`未定義の共有パッケージです: ${name}`);
    }

    dependencies[name] = overrides[name];
  }
}
