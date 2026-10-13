import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// 拡張子付きの参照はそのまま解決し、既存の拡張子なし参照は実ファイルの一覧で維持する。
const imports = {
  "#client/*": "./src/*",
};

// Storybook専用の入口を公開importマップへ混ぜない。パス区切りは実行OSに依存させない。
function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if (path !== "src/shared/testing") {
        visit(path);
      }
    } else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".stories.tsx")) {
      imports["#client/" + path.slice("src/".length, -".tsx".length)] = "./" + path;
    } else if (entry.name.endsWith(".ts")) {
      imports["#client/" + path.slice("src/".length, -".ts".length)] = "./" + path;
      if (entry.name === "index.ts") {
        imports["#client/" + directory.slice("src/".length)] = "./" + path;
      }
    }
  }
}

visit("src");
const file = "package.json";
const pkg = JSON.parse(readFileSync(file, "utf8"));
// 生成対象はimportsだけ。他の公開exports・依存・スクリプト設定は保持する。
pkg.imports = imports;
writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
