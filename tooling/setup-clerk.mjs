import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const apps = ["api", "web", "business", "admin"];
const localOrigins = "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175";

/** 同じ開発用Clerkの鍵を4アプリへ接続し、無関係なローカル設定を保持する。 */
export function setupLocalClerk(root, sourceFile = "apps/api/.dev.vars") {
  const { secretKey, publishableKey } = developmentClerkKeys(root, sourceFile);
  const changes = [];
  for (const app of apps) {
    const file = resolve(root, `apps/${app}/.dev.vars`);
    const template = resolve(root, `apps/${app}/.dev.vars.example`);
    const original = readFileSync(existsSync(file) ? file : template, "utf8");
    changes.push([
      file,
      updateEnvironment(original, {
        APP_ENV: "local",
        CLERK_SECRET_KEY: secretKey,
        CLERK_AUTHORIZED_PARTIES: localOrigins,
        ...(app === "api"
          ? { AUTH_MODE: "clerk", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey }
          : {}),
      }),
    ]);
    if (app !== "api") {
      changes.push(publicKeyChange(root, app, publishableKey));
    }
  }

  // 全ファイルの準備が済んでから書き込み、鍵の値は出力しない。
  for (const [file, contents] of changes) {
    writeFileSync(file, contents, { mode: 0o600 });
    chmodSync(file, 0o600);
  }
}

function updateEnvironment(original, values) {
  let result = original;
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}=.*$`, "gm");
    const assignment = `${key}=${JSON.stringify(value)}`;
    if (pattern.test(result)) {
      result = result.replace(pattern, () => assignment);
    } else {
      result = `${result.replace(/\n?$/, "\n")}${assignment}\n`;
    }
  }

  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    setupLocalClerk(process.cwd(), process.argv[2]);
    console.log("APIと3画面を開発用Clerkへ接続しました。pnpm devで起動してください。");
  } catch {
    console.error(
      "Clerkの設定に失敗しました。開発用の秘密鍵・公開鍵と環境変数ファイルを確認してください。",
    );
    process.exitCode = 1;
  }
}

function developmentClerkKeys(root, sourceFile) {
  const sourcePath = resolve(root, sourceFile);
  if (!existsSync(sourcePath)) {
    throw new Error("開発用Clerkの環境変数ファイルを用意してください");
  }

  const source = parseEnv(readFileSync(sourcePath, "utf8"));
  const secretKey = source.CLERK_SECRET_KEY;
  const publishableKey =
    source.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? source.VITE_CLERK_PUBLISHABLE_KEY;
  if (!secretKey?.startsWith("sk_test_") || !publishableKey?.startsWith("pk_test_")) {
    throw new Error("CLERK_SECRET_KEYと開発用の公開鍵（pk_test_）を設定してください");
  }

  return { secretKey, publishableKey };
}

function publicKeyChange(root, app, publishableKey) {
  const publicFile = resolve(root, `apps/${app}/.env.local`);
  const originalPublic = existsSync(publicFile) ? readFileSync(publicFile, "utf8") : "";
  return [
    publicFile,
    updateEnvironment(originalPublic, { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey }),
  ];
}
