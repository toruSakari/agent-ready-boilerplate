// @vitest-environment node
import { afterEach, expect, it, vi } from "vite-plus/test";
import { notFound, redirect } from "@tanstack/react-router";
import {
  observeRequest,
  observeServerFunction,
  withRequestLogging,
} from "@dev-template/config/request-logging";
import { startFunctionLogging, startRequestLogging } from "@dev-template/config/start-logging";

afterEach(() => vi.restoreAllMocks());

it(
  "WorkerとStartのログ境界" +
    " / " +
    "実際のStartミドルウェアとWorkerで相関IDを共有し、URL・Cookie・本文・結果は記録しない",
  async () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    const request = new Request("https://example.test/person@example.test?token=invite-secret", {
      method: "POST",
      headers: { cookie: "session-secret", "x-request-id": "00000000-0000-4000-8000-000000000001" },
      body: JSON.stringify({ email: "person@example.test" }),
    });
    const response = new Response("result-secret", { status: 201 });
    const worker = withRequestLogging(async (req) => {
      const result = await Reflect.apply(startRequestLogging.options.server!, undefined, [
        {
          request: req,
          next: async () => {
            await Reflect.apply(startFunctionLogging.options.server!, undefined, [
              { method: "POST", next: async () => ({ result: "result-secret" }) },
            ]);
            return { response };
          },
        },
      ]);
      return result.response;
    }, "web");
    expect(await worker(request)).toBe(response);
    expect(request.bodyUsed).toBe(false);
    const entries = output.mock.calls.map((props) => JSON.parse(props[0]));
    expect(entries.map((entry) => entry.boundary)).toEqual(["server_function", "start", "worker"]);
    expect(new Set(entries.map((entry) => entry.requestId)).size).toBe(1);
    expect(entries[0].requestId).not.toBe(request.headers.get("x-request-id"));
    expect(entries[2]).toMatchObject({ service: "web", method: "POST", status: 201 });
    for (const secret of [
      "person@example.test",
      "invite-secret",
      "session-secret",
      "result-secret",
    ]) {
      expect(JSON.stringify(entries)).not.toContain(secret);
    }
  },
);

it(
  "WorkerとStartのログ境界" +
    " / " +
    "並行するWorker要求の文脈を混ぜず、env・ExecutionContextを保持する",
  async () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const environment = { secret: "binding-secret" };
    const execution = { waitUntil: vi.fn() };
    const slow = withRequestLogging(async (request, env, context) => {
      expect(env).toBe(environment);
      expect(context).toBe(execution);
      await barrier;
      return observeRequest(
        "start",
        request,
        () => new Response("slow"),
        (result) => result.status,
      );
    }, "business");
    const fast = withRequestLogging(
      async (request) =>
        observeRequest(
          "start",
          request,
          () => new Response("fast"),
          (result) => result.status,
        ),
      "admin",
    );
    const pending = slow(new Request("https://example.test/slow"), environment, execution);
    await fast(new Request("https://example.test/fast"));
    release();
    await pending;
    const entries = output.mock.calls.map((props) => JSON.parse(props[0]));
    expect(entries.map((entry) => entry.service)).toEqual([
      "admin",
      "admin",
      "business",
      "business",
    ]);
    expect(entries[0].requestId).toBe(entries[1].requestId);
    expect(entries[2].requestId).toBe(entries[3].requestId);
    expect(entries[0].requestId).not.toBe(entries[2].requestId);
    expect(JSON.stringify(entries)).not.toContain("binding-secret");
  },
);

it(
  "WorkerとStartのログ境界" + " / " + "例外本文を記録せず、同じ例外をError Boundaryへ伝える",
  async () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("person@example.test invite-secret");
    const worker = withRequestLogging(async () => {
      throw error;
    }, "web");
    await expect(worker(new Request("https://example.test/"))).rejects.toBe(error);
    expect(JSON.parse(output.mock.calls[0]![0])).toMatchObject({
      event: "request_failed",
      boundary: "worker",
    });
    expect(JSON.stringify(output.mock.calls)).not.toContain(error.message);
  },
);

it.each([redirect({ href: "/sign-in" }), notFound()])(
  "WorkerとStartのログ境界" + " / " + "遷移・未検出を障害通知に変えない: %j",
  async (controlFlow) => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      observeRequest(
        "start",
        new Request("https://example.test/"),
        async () => {
          throw controlFlow;
        },
        () => 200,
      ),
    ).rejects.toBe(controlFlow);
    expect(error).not.toHaveBeenCalled();
    expect(JSON.parse(output.mock.calls[0]![0])).toMatchObject({ event: "request_completed" });
  },
);

it(
  "WorkerとStartのログ境界" +
    " / " +
    "server functionの返却された障害も検出し、例外・入力・結果を記録しない",
  async () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = { error: new Error("person@example.test"), result: { token: "invite-secret" } };
    expect(await observeServerFunction("GET", async () => result)).toBe(result);
    expect(JSON.parse(output.mock.calls[0]![0])).toMatchObject({
      event: "server_function_failed",
      boundary: "server_function",
    });
    expect(JSON.stringify(output.mock.calls)).not.toContain("person@example.test");
    expect(JSON.stringify(output.mock.calls)).not.toContain("invite-secret");
  },
);
