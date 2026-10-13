export const E2E_SERVER_ORIGINS = Object.freeze({
  api: "http://127.0.0.1:8787",
  web: "http://127.0.0.1:5173",
  business: "http://127.0.0.1:5174",
  admin: "http://127.0.0.1:5175",
});
// 初回の3画面buildを待つ上限と個々の疎通期限を分け、起動中の一回の失敗で全体を止めない。
export const E2E_SERVER_STARTUP_TIMEOUT_MS = 180_000;
export const E2E_SERVER_SHUTDOWN_TIMEOUT_MS = 10_000;
export const E2E_HEALTH_REQUEST_TIMEOUT_MS = 1_000;
export const E2E_HEALTH_POLL_INTERVALS_MS = [100, 250, 500, 1_000];
