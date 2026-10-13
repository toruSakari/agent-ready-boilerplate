import {
  cloudflareApi,
  previewResourceNames,
  provisionPreviewResources,
  deletePreviewResources,
} from "#tooling/preview-resources.mjs";
import { unstable_readConfig } from "wrangler";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const action = process.argv[2];
const id = process.argv[3];
if (!["prepare", "deploy", "delete"].includes(action) || !/^[1-9]\d*$/.test(id ?? "")) {
  throw new Error("preview.mjs prepare|deploy|delete PR番号");
}

const apps = ["api", "web", "business", "admin"];
const name = (app) => `dev-template-${app}-pr-${id}`;
const directory = resolve(".preview");
mkdirSync(directory, { recursive: true });

function run(args) {
  const result = spawnSync("corepack", ["pnpm", "exec", "wrangler", ...args], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error("Preview操作に失敗しました");
  }
}

// 削除はフロントからAPIへ逆順に行い、参照する側のWorkerを先に外す。
if (action === "delete") {
  const api = cloudflareApi(process.env);
  for (const app of [...apps].reverse()) {
    await api(`/workers/scripts/${name(app)}?force=true`, "DELETE");
  }

  await deletePreviewResources(id, api, async (bucket, key) => {
    // R2のデータ操作はアカウントREST APIではなく、WranglerのオブジェクトAPIを使う。
    run(["r2", "object", "delete", `${bucket}/${key}`, "--remote"]);
  });
} else {
  const config = unstable_readConfig({ config: "apps/api/wrangler.jsonc" });
  const preview = config.previews;
  // prepareはリソース名の確認だけ。配備時にPR専用リソースを作成・再利用する。
  if (
    action === "deploy" &&
    (!process.env.CLERK_SECRET_KEY ||
      !process.env.NEXT_PUBLIC_BUSINESS_ORIGIN ||
      !new URL(process.env.NEXT_PUBLIC_BUSINESS_ORIGIN).hostname.startsWith(
        `dev-template-business-pr-${id}.`,
      ))
  ) {
    throw new Error("Preview用のClerk鍵とPR専用オリジンが必要です");
  }

  const resources =
    action === "deploy"
      ? await provisionPreviewResources(id, cloudflareApi(process.env))
      : { ...previewResourceNames(id), databaseId: "00000000-0000-0000-0000-000000000000" };
  const api = {
    name: name("api"),
    main: resolve("apps/api/dist/worker-entry.js"),
    compatibility_date: config.compatibility_date,
    compatibility_flags: config.compatibility_flags,
    vars: {
      ...config.vars,
      ...preview.vars,
      APP_ENV: "preview",
      ADMIN_ACCESS_ISSUER: process.env.ADMIN_ACCESS_ISSUER ?? config.vars.ADMIN_ACCESS_ISSUER,
      ADMIN_ACCESS_AUDIENCE: process.env.ADMIN_ACCESS_AUDIENCE ?? config.vars.ADMIN_ACCESS_AUDIENCE,
      CLERK_AUTHORIZED_PARTIES: process.env.NEXT_PUBLIC_BUSINESS_ORIGIN
        ? ["web", "business", "admin"]
            .map((app) =>
              process.env.NEXT_PUBLIC_BUSINESS_ORIGIN.replace(
                "dev-template-business-pr-",
                `dev-template-${app}-pr-`,
              ),
            )
            .join(",")
        : config.vars.CLERK_AUTHORIZED_PARTIES,
    },
    d1_databases: [
      {
        binding: "DB",
        database_name: resources.database,
        database_id: resources.databaseId,
        migrations_dir: resolve("apps/api/drizzle"),
      },
    ],
    r2_buckets: [{ binding: "PRODUCT_IMAGES", bucket_name: resources.bucket }],
    queues: {
      producers: [{ binding: "ORDER_EVENTS", queue: resources.queue }],
      consumers: [
        { queue: resources.queue, max_batch_size: 10, max_batch_timeout: 5, max_retries: 3 },
      ],
    },
    durable_objects: config.durable_objects,
    migrations: config.migrations,
    observability: config.observability,
    triggers: config.triggers,
  };
  const apiFile = resolve(directory, "api.json");
  writeFileSync(apiFile, JSON.stringify(api, null, 2));
  for (const app of apps.filter((a) => a !== "api")) {
    const source = resolve(`apps/${app}/dist/server/wrangler.json`);
    const frontend = JSON.parse(readFileSync(source, "utf8"));
    frontend.name = name(app);
    frontend.main = resolve(dirname(source), frontend.main);
    frontend.assets.directory = resolve(dirname(source), frontend.assets.directory);
    frontend.vars = {
      ...frontend.vars,
      APP_ENV: "preview",
      CLERK_AUTHORIZED_PARTIES: api.vars.CLERK_AUTHORIZED_PARTIES,
    };
    // 各画面のService Bindingも同じPRのAPIへ向け、別PRや本番へ接続しない。
    frontend.services = [{ binding: "API", service: name("api") }];
    delete frontend.previews;
    writeFileSync(resolve(directory, `${app}.json`), JSON.stringify(frontend, null, 2));
  }

  if (action === "deploy") {
    if (
      !process.env.NEXT_PUBLIC_BUSINESS_ORIGIN ||
      !new URL(process.env.NEXT_PUBLIC_BUSINESS_ORIGIN).hostname.startsWith(
        `dev-template-business-pr-${id}.`,
      )
    ) {
      throw new Error("PR専用のNEXT_PUBLIC_BUSINESS_ORIGINが必要です");
    }

    const preflight = spawnSync(
      process.execPath,
      ["apps/api/tooling/check-inventory-migration.mjs", "--config", apiFile],
      { stdio: "inherit" },
    );
    if (preflight.status !== 0) {
      throw new Error("Preview DBの移行前確認に失敗しました");
    }

    run(["d1", "migrations", "apply", "DB", "--remote", "--config", apiFile]);
    for (const app of apps) {
      const path = resolve(directory, `${app}.json`);
      run(["deploy", "--config", path]);
      deploySecrets(path);
    }
  }
}

function deploySecrets(path) {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("Preview用CLERK_SECRET_KEYが必要です");
  }

  const secrets = resolve(directory, "secrets.json");
  writeFileSync(
    secrets,
    JSON.stringify({
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
      ...(process.env.SENTRY_DSN ? { SENTRY_DSN: process.env.SENTRY_DSN } : {}),
    }),
  );
  try {
    run(["secret", "bulk", secrets, "--config", path]);
    // CLIへの一時的な受け渡しファイルは、送信が失敗した場合も残さない。
  } finally {
    rmSync(secrets, { force: true });
  }
}
