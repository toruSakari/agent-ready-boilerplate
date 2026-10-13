import { z } from "zod";
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { PLATFORM_PERMISSIONS } from "@dev-template/api/access-permissions";

const { values } = parseArgs({
  options: {
    "user-id": { type: "string" },
    email: { type: "string" },
    name: { type: "string" },
    remote: { type: "boolean", default: false },
  },
});
const subject = z.string().min(1).max(200).parse(values["user-id"]);
const email = z.email().parse(values.email).toLowerCase();
const name = z.string().trim().min(1).max(100).parse(values.name);
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const scope = "platform";
const role = "platform:admin";
// Clerk subjectと運営会員IDを分け、他サービスへの登録を暗黙に作らない。
const accountId = "operator:" + randomUUID();
const membershipId = "operator:" + randomUUID();
// 初期オーナーが存在するときは新しい管理所属を付与しない。通常の追加は招待を使う。
const noOwner =
  "NOT EXISTS (SELECT 1 FROM operator_memberships m JOIN operator_accounts a ON a.id=m.operator_accounts_id AND a.deleted=0 JOIN access_roles r ON r.id=m.access_roles_id AND r.scope=m.scope WHERE m.scope='platform' AND r.protected_role=1)";
const activeAccount = `SELECT id FROM operator_accounts WHERE subject_id=${quote(subject)} AND deleted=0`;
const statements = [
  `INSERT INTO access_roles (id,scope,name,protected_role) VALUES ('${role}','${scope}','管理者',1) ON CONFLICT(id) DO NOTHING;`,
  ...PLATFORM_PERMISSIONS.map(
    (p) =>
      `INSERT INTO role_permissions (id,access_roles_id,permissions_id) VALUES (${quote(role + ":" + p)},'${role}',${quote(p)}) ON CONFLICT(access_roles_id,permissions_id) DO NOTHING;`,
  ),
  `INSERT INTO operator_accounts (id,subject_id,name,email,deleted) SELECT ${quote(accountId)},${quote(subject)},${quote(name)},${quote(email)},0 WHERE ${noOwner} AND NOT EXISTS (${activeAccount});`,
  `INSERT INTO operator_memberships (id,scope,operator_accounts_id,access_roles_id) SELECT ${quote(membershipId)},'${scope}',id,'${role}' FROM operator_accounts WHERE subject_id=${quote(subject)} AND deleted=0 AND ${noOwner} ON CONFLICT(scope,operator_accounts_id) DO UPDATE SET access_roles_id=excluded.access_roles_id;`,
  `UPDATE access_revision SET version=version+1,mutation_id='bootstrap';`,
];
// SQL用に引用符をエスケープした入力を一時ファイルへ置き、実行後はfinallyで削除する。
const dir = mkdtempSync(join(tmpdir(), "access-bootstrap-"));
const file = join(dir, "bootstrap.sql");
writeFileSync(file, statements.join("\n"));
try {
  const result = spawnSync(
    "corepack",
    [
      "pnpm",
      "exec",
      "wrangler",
      "d1",
      "execute",
      "DB",
      values.remote ? "--remote" : "--local",
      "--config",
      "wrangler.jsonc",
      "--file",
      file,
    ],
    { stdio: "inherit" },
  );
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
