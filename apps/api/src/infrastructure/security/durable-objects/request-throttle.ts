import { DurableObject } from "cloudflare:workers";
import { z } from "zod";

import {
  THROTTLE_POLICY,
  MAX_RPC_BATCH_SIZE,
} from "#api/application/security/policies/request-limits.ts";

const inputSchema = z.object({
  scope: z.enum(["ip", "subject"]),
  cost: z.number().int().min(1).max(MAX_RPC_BATCH_SIZE),
});

type Bucket = { tokens: number; updatedAt: number };

/** キーごとのDOで判定・保存を直列化し、Workerや地域をまたぐ要求にも同じ枠を使う。 */
export class RequestThrottle extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const input = inputSchema.parse(await request.json());
    return this.ctx.blockConcurrencyWhile(async () => {
      const policy = THROTTLE_POLICY[input.scope];
      const now = Date.now();
      const stored = await this.ctx.storage.get<Bucket>("bucket");
      const available = stored
        ? Math.min(
            policy.capacity,
            stored.tokens +
              (Math.max(0, now - stored.updatedAt) * policy.capacity) / policy.intervalMs,
          )
        : policy.capacity;
      const allowed = available >= input.cost;
      await this.ctx.storage.put("bucket", {
        tokens: allowed ? available - input.cost : available,
        updatedAt: now,
      });
      await this.ctx.storage.setAlarm(now + policy.intervalMs * 2);
      return Response.json({
        allowed,
        retryAfter: allowed
          ? 0
          : Math.ceil(((input.cost - available) * policy.intervalMs) / policy.capacity / 1000),
      });
    });
  }

  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const bucket = await this.ctx.storage.get<Bucket>("bucket");
      const idleMs =
        Math.max(THROTTLE_POLICY.ip.intervalMs, THROTTLE_POLICY.subject.intervalMs) * 2;
      if (!bucket || Date.now() - bucket.updatedAt >= idleMs) {
        await this.ctx.storage.deleteAll();
      } else {
        await this.ctx.storage.setAlarm(bucket.updatedAt + idleMs);
      }
    });
  }
}
