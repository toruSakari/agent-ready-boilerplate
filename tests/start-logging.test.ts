// @vitest-environment node
import { describe, expect, it, vi } from "vite-plus/test";
import { startInstance as web } from "@/apps/web/app/start.ts";
import { startInstance as business } from "@/apps/business/app/start.ts";
import { startInstance as admin } from "@/apps/admin/app/start.ts";

describe.each([
  { service: "web", instance: web },
  { service: "business", instance: business },
  { service: "admin", instance: admin },
])("$serviceのStart起動設定", (props) => {
  it("ログ設定を追加してもクロスサイトのserver functionを拒否する", async () => {
    await assertCrossSiteRejected(props.instance);
  });

  it("同一オリジンのserver functionと通常のSSRは維持する", async () => {
    const options = await props.instance.getOptions();
    const csrf = options.requestMiddleware?.[1];
    if (!csrf?.options.server) {
      throw new Error("CSRF middlewareが設定されていません");
    }

    const next = vi.fn().mockResolvedValue({ response: new Response("ok") });
    for (const [handlerType, headers] of [
      ["serverFn", { origin: "https://app.example.test" }],
      ["router", {}],
    ] as const) {
      const result = await Reflect.apply(csrf.options.server, undefined, [
        {
          handlerType,
          next,
          request: new Request("https://app.example.test/", { headers }),
        },
      ]);
      expect(result.response.status).toBe(200);
    }

    expect(next).toHaveBeenCalledTimes(2);
  });

  it.each([
    new Headers(),
    new Headers({ origin: "null" }),
    new Headers({ origin: "https://other.example.test", "sec-fetch-site": "same-site" }),
    new Headers({ referer: "https://app.example.test.evil.test/" }),
  ])("実際に使うGETでも信頼できない呼び出し元%jを拒否する", async (headers) => {
    const options = await props.instance.getOptions();
    const csrf = options.requestMiddleware?.[1];
    if (!csrf?.options.server) {
      throw new Error("CSRF middlewareが設定されていません");
    }

    const next = vi.fn();
    const result = await Reflect.apply(csrf.options.server, undefined, [
      {
        handlerType: "serverFn",
        next,
        request: new Request("https://app.example.test/_serverFn/test", { headers }),
      },
    ]);
    expect(result.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

async function assertCrossSiteRejected(instance: typeof web) {
  const options = await instance.getOptions();
  const csrf = options.requestMiddleware?.[1];
  if (!csrf?.options.server) {
    throw new Error("CSRF middlewareが設定されていません");
  }

  const next = vi.fn();
  const result = await Reflect.apply(csrf.options.server, undefined, [
    {
      handlerType: "serverFn",
      next,
      request: new Request("https://app.example.test/_serverFn/function", {
        method: "POST",
        headers: { origin: "https://attacker.example.test", "sec-fetch-site": "cross-site" },
      }),
    },
  ]);
  expect(result.status).toBe(403);
  expect(next).not.toHaveBeenCalled();
}
