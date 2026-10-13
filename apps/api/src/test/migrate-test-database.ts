import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** 結合テストでも本番と同じマイグレーションを順番に適用する。 */
export async function migrateTestDatabase(database: D1Database): Promise<void> {
  const directory = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const name of readdirSync(directory)
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    const source = readFileSync(join(directory, name), "utf8");
    for (const statement of source.split(
      source.includes("CREATE TRIGGER") ? "--> statement-breakpoint" : ";",
    )) {
      const sql = statement.replace(/--[^\n]*/g, "").trim();
      if (sql) {
        await database.prepare(sql).run();
      }
    }
  }
}
