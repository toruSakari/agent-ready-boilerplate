import { Hono } from "hono";
import { throttleRequests } from "#api/presentation/shared/middleware/request-throttle.ts";
import type { RequestActorEnv } from "#api/presentation/shared/middleware/authentication.ts";
export { RequestThrottle } from "#api/infrastructure/security/durable-objects/request-throttle.ts";

const app = new Hono<RequestActorEnv>();
app.use("/*", throttleRequests("ip"));
app.use("/*", async (context, next) => {
  context.set("actor", {
    userId: "fixture",
    subjectId: context.req.header("x-test-subject") ?? "fixture",
    tenantId: "",
    role: "member",
    permissions: [],
  });
  await next();
});
app.use("/*", throttleRequests("subject"));
app.get("/*", (context) => context.json({ ok: true }));
export default { fetch: app.fetch };
