// @vitest-environment node
import { expect, it } from "vite-plus/test";
import {
  authenticateRequest,
  ORIGIN,
  PUBLISHABLE_KEY,
  SECRET_KEY,
  options,
  documentRequest,
  expectPrivate,
  expectContinue,
  expectBlocked,
} from "@/tests/frontend-auth-fixture.ts";
import { synchronizeFrontendSession } from "@dev-template/config/auth";

it.each([
  {},
  { CLERK_SECRET_KEY: SECRET_KEY },
  { CLERK_AUTHORIZED_PARTIES: ORIGIN },
  { CLERK_SECRET_KEY: SECRET_KEY, CLERK_AUTHORIZED_PARTIES: "" },
])(
  "設定不備時の拒否とローカルデモの利用条件 / 本番用の設定が不足している場合は503を返す: %j",
  async (environment) => {
    expectBlocked(
      await synchronizeFrontendSession(documentRequest("/account"), options({ environment })),
      503,
    );
    expect(authenticateRequest).not.toHaveBeenCalled();
  },
);

it.each([undefined, "not-a-publishable-key", "pk_live_!!!"])(
  "設定不備時の拒否とローカルデモの利用条件 / キー%sが未設定または不正なら拒否する",
  async (publishableKey) => {
    expectBlocked(
      await synchronizeFrontendSession(documentRequest("/account"), options({ publishableKey })),
      503,
    );
    expect(authenticateRequest).not.toHaveBeenCalled();
  },
);

it.each([
  "https://web.example.com/",
  "http://web.example.com",
  "https://web.example.com/path",
  "https://user@web.example.com",
  "https://web.example.com,",
  "not-an-origin",
  "*",
])("設定不備時の拒否とローカルデモの利用条件 / オリジン設定%sが不正なら拒否する", async (value) => {
  expectBlocked(
    await synchronizeFrontendSession(
      documentRequest("/account"),
      options({ environment: { CLERK_SECRET_KEY: SECRET_KEY, CLERK_AUTHORIZED_PARTIES: value } }),
    ),
    503,
  );
  expect(authenticateRequest).not.toHaveBeenCalled();
});

it.each(["localhost", "127.0.0.1", "[::1]"])(
  "設定不備時の拒否とローカルデモの利用条件 / %sで明示したローカル開発ではキーなしの利用を許可する",
  async (host) => {
    const response = await synchronizeFrontendSession(
      new Request(`http://${host}:5173/account`),
      options({
        development: true,
        environment: { APP_ENV: "local" },
        publishableKey: undefined,
      }),
    );
    expectContinue(response);
    expectPrivate(response);
    expect(authenticateRequest).not.toHaveBeenCalled();
  },
);

it.each([
  { development: false, appEnv: "local", host: "127.0.0.1" },
  { development: true, appEnv: "production", host: "127.0.0.1" },
  { development: true, appEnv: "preview", host: "127.0.0.1" },
  { development: true, appEnv: undefined, host: "127.0.0.1" },
  { development: true, appEnv: "local", host: "web.example.com" },
  { development: true, appEnv: "local", host: "localhost.evil.example" },
  { development: true, appEnv: "local", host: "192.168.1.1" },
])(
  "設定不備時の拒否とローカルデモの利用条件 / ローカル環境の条件をすべて満たさなければキーなしデモを拒否する: %j",
  async (props) => {
    expectBlocked(
      await synchronizeFrontendSession(
        new Request(`http://${props.host}/account`, {
          headers: {
            host: "localhost",
            "x-forwarded-host": "localhost",
            "x-demo-user": "user_fixture",
          },
        }),
        options({
          development: props.development,
          environment: { APP_ENV: props.appEnv },
          publishableKey: undefined,
        }),
      ),
      503,
    );
  },
);

it.each(["publishable", "secret"])(
  "設定不備時の拒否とローカルデモの利用条件 / %sキーだけが設定されている場合はデモを使わない",
  async (key) => {
    expectBlocked(
      await synchronizeFrontendSession(
        new Request("http://localhost:5173/account"),
        options({
          development: true,
          environment: {
            APP_ENV: "local",
            ...(key === "secret" ? { CLERK_SECRET_KEY: SECRET_KEY } : {}),
          },
          publishableKey: key === "publishable" ? PUBLISHABLE_KEY : undefined,
        }),
      ),
      503,
    );
  },
);

it.each([
  "/@vite/client",
  "/@react-refresh",
  "/@id/react",
  "/@fs/file.ts",
  "/node_modules/react",
  "/src/main.tsx",
  "/app/page.tsx",
])(
  "設定不備時の拒否とローカルデモの利用条件 / ローカル開発用アセット%sはClerkなしで利用できる",
  async (path) => {
    expectContinue(
      await synchronizeFrontendSession(
        new Request(`http://localhost:5173${path}`),
        options({ development: true, environment: { APP_ENV: "local" } }),
      ),
    );
    expect(authenticateRequest).not.toHaveBeenCalled();
  },
);
