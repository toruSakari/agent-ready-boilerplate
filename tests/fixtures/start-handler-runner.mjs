import { registerHooks, createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// 入力解析・エラー変換はインストールされたSDKをそのまま実行し、アプリ解決と要求ストアだけを隔離する。
const require = createRequire(import.meta.url);
const start = dirname(require.resolve("@tanstack/react-start/package.json"));
const core = dirname(
  require.resolve("@tanstack/start-server-core/package.json", { paths: [start] }),
);
const resolver = pathToFileURL(join(core, "dist/esm/getServerFnById.js")).href;
const response = pathToFileURL(join(core, "dist/esm/request-response.js")).href;
const router = dirname(require.resolve("@tanstack/router-core/package.json", { paths: [core] }));
const { redirect, notFound } = await import(pathToFileURL(join(router, "dist/esm/index.js")));
let invoked = false;
globalThis.testAction = async () => {
  invoked = true;
  if (process.argv[2] === "thrown") {
    throw new Error("private_database_detail");
  }

  if (process.argv[2] === "returned") {
    return { error: new Error("private_database_detail") };
  }

  if (process.argv[2] === "redirect") {
    throw redirect({ to: "/sign-in" });
  }

  if (process.argv[2] === "not-found") {
    throw notFound();
  }

  return { result: "ok" };
};
registerHooks({
  load(url, context, next) {
    if (url === resolver) {
      return {
        format: "module",
        shortCircuit: true,
        source:
          "export const getServerFnById = async () => { if (process.argv[2] === 'resolver') throw new Error('Server function info not found for person@example.test'); return globalThis.testAction; };",
      };
    }

    if (url === response) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export const getResponse = () => ({ status: 200, headers: new Headers() });",
      };
    }

    return next(url, context);
  },
});
const logs = [];
console.error = console.warn = (...args) => logs.push(args.map(String).join(" "));
const { handleServerAction } = await import(
  pathToFileURL(join(core, "dist/esm/server-functions-handler.js"))
);
const malformed = process.argv[2] === "get" || process.argv[2] === "post";
const form = process.argv[2] === "form";
const post = process.argv[2] === "post" || form;
let formData;
if (form) {
  process.env.NODE_ENV = "development";
  const clientCore = dirname(
    require.resolve("@tanstack/start-client-core/package.json", { paths: [core] }),
  );
  const { TSS_FORMDATA_CONTEXT } = await import(
    pathToFileURL(join(clientCore, "dist/esm/constants.js"))
  );
  formData = new FormData();
  formData.set(TSS_FORMDATA_CONTEXT, "person@example.test");
}

const request = new Request(
  `https://app.example.test/_serverFn/test${malformed && !post ? "?payload=person%40example.test" : ""}`,
  {
    method: post ? "POST" : "GET",
    headers: {
      "x-tsr-serverFn": "true",
      ...(post && !form ? { "content-type": "application/json" } : {}),
    },
    ...(post ? { body: form ? formData : "person@example.test" } : {}),
  },
);
const { runWithStartContext } = await import(
  pathToFileURL(
    join(
      dirname(require.resolve("@tanstack/start-storage-context/package.json", { paths: [core] })),
      "dist/esm/index.js",
    ),
  )
);
const result = await runWithStartContext({ startOptions: {} }, () =>
  handleServerAction({ request, context: {}, serverFnId: "test" }),
);
process.stdout.write(
  JSON.stringify({ status: result.status, body: await result.text(), logs, invoked }),
);
