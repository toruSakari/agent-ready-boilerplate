import type { APIRequestContext } from "@playwright/test";
import { expect } from "@/e2e/fixtures";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";

export const QUEUE_SETTLEMENT_TIMEOUT_MS = 15_000;
export const QUEUE_SETTLEMENT_POLL_INTERVALS_MS = [250, 500, 1_000];

// ローカル開発ではcronを自動実行しないため、Outboxの配送をscheduled入口から開始する。
export async function triggerScheduledWork(request: APIRequestContext) {
  const response = await request.get(`${E2E_SERVER_ORIGINS.api}/cdn-cgi/local/scheduled`);
  expect(response.ok()).toBe(true);
}
