import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  request: async (props, use) => {
    const context = await props.playwright.request.newContext({
      // HTTP検証も画面Worker経由でAPIへ接続し、実際のプロキシ境界を通す。
      baseURL: "http://127.0.0.1:5174",
      extraHTTPHeaders: { "x-organization-id": "demo-store" },
    });
    await use(context);
    await context.dispose();
  },
});
export { expect };
