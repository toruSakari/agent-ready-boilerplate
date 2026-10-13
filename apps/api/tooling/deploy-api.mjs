import { spawnSync } from "node:child_process";

const args = ["pnpm", "exec", "wrangler", "deploy", "--config", "wrangler.jsonc"];
// CIから渡す公開認証設定だけをvarsに載せる。秘密鍵の設定はWrangler secretsの責務。
for (const name of ["ADMIN_ACCESS_ISSUER", "ADMIN_ACCESS_AUDIENCE", "CLERK_AUTHORIZED_PARTIES"]) {
  if (process.env[name]) {
    args.push("--var", `${name}:${process.env[name]}`);
  }
}

const result = spawnSync("corepack", args, { stdio: "inherit" });
process.exitCode = result.status ?? 1;
