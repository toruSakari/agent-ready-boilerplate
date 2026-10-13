import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy, unstable_readConfig } from "wrangler";
import { seedDevelopment } from "#api-tooling/seeds/seed-development.ts";

const config = unstable_readConfig({
  config: fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)),
});
const database = config.d1_databases.find((props) => props.binding === "DB");
if (!database) {
  throw new Error("ローカルseed用のDB bindingが設定されていません。");
}

const directory = await mkdtemp(join(tmpdir(), "dev-template-seed-"));
let platform;
try {
  const configPath = join(directory, "wrangler.json");
  // DBの識別子は配備設定を正本にし、seedが不要なDO・Queue・認証設定へ依存しないよう接続だけ抜き出す。
  await writeFile(
    configPath,
    JSON.stringify({
      name: config.name,
      compatibility_date: config.compatibility_date,
      d1_databases: [
        { binding: "DB", database_name: database.database_name, database_id: database.database_id },
      ],
    }),
  );
  // 接続先を引数で切り替えず、remote指定のbindingもローカルへ固定する。
  platform = await getPlatformProxy({
    configPath,
    persist: { path: fileURLToPath(new URL("../.wrangler/state/v3", import.meta.url)) },
    remoteBindings: false,
    envFiles: [],
  });
  await seedDevelopment(drizzle(platform.env.DB));
  console.log("ローカルのデモデータを投入しました。");
} finally {
  try {
    await platform?.dispose();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
