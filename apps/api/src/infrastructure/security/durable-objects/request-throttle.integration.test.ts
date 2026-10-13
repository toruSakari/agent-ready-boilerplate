// @vitest-environment node
import { fileURLToPath } from "node:url";
import { createTestHarness } from "wrangler";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";

const server = createTestHarness({
  root: fileURLToPath(new URL("./", import.meta.url)),
  workers: [{ configPath: "./wrangler.throttle-test.jsonc" }],
});
beforeAll(async () => {
  await server.listen();
}, 30_000);
afterAll(async () => {
  await server.close();
});
it("workerdの並行要求でも本人枠を原子的に消費し、別本人は独立した枠を使う", async () => {
  const path = `/api/trpc/${Array(20).fill("operation").join(",")}?batch=1`;
  const responses = await Promise.all(
    Array.from({ length: 40 }, () =>
      server.fetch(path, {
        headers: { "cf-connecting-ip": "203.0.113.1", "x-test-subject": "parallel-subject" },
      }),
    ),
  );
  expect(responses.filter((response) => response.status === 200)).toHaveLength(30);
  const rejected = responses.find((response) => response.status === 429)!;
  expect(rejected.headers.get("Retry-After")).not.toBeNull();
  expect(await rejected.json()).toMatchObject(
    Array.from({ length: 20 }, () => ({
      error: { data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 } },
    })),
  );
  expect(
    (
      await server.fetch(path, {
        headers: { "cf-connecting-ip": "203.0.113.1", "x-test-subject": "other-subject" },
      })
    ).status,
  ).toBe(200);
});
