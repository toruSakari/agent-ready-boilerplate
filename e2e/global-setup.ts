import { expect } from "@playwright/test";
import {
  E2E_SERVER_ORIGINS,
  E2E_SERVER_STARTUP_TIMEOUT_MS,
  E2E_HEALTH_REQUEST_TIMEOUT_MS,
  E2E_HEALTH_POLL_INTERVALS_MS,
} from "@/e2e/server-policy";

export default async function waitForAllWorkers() {
  // 画面の起動だけで成功とせず、各Workerから共通APIへのService Bindingも疎通確認する。
  await Promise.all(
    Object.entries(E2E_SERVER_ORIGINS).map(async (props) => {
      await expect
        .poll(
          async () => {
            try {
              const response = await fetch(`${props[1]}/api/health`, {
                signal: AbortSignal.timeout(E2E_HEALTH_REQUEST_TIMEOUT_MS),
              });
              if (!response.ok) {
                return false;
              }

              const body: unknown = await response.json();
              return (
                typeof body === "object" &&
                body !== null &&
                "status" in body &&
                body.status === "ok"
              );
            } catch {
              return false;
            }
          },
          {
            message: `${props[0]}と共通APIへの接続が利用可能になるまで待機します`,
            timeout: E2E_SERVER_STARTUP_TIMEOUT_MS,
            intervals: E2E_HEALTH_POLL_INTERVALS_MS,
          },
        )
        .toBe(true);
    }),
  );
}
