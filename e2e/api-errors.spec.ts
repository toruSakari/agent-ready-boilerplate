import { expect, test } from "@/e2e/fixtures";

// 画像もtRPCのエラー形式へ揃え、未知APIだけはHTTPの404契約を確認する。
test("APIの入力不備・権限不足・未検出を日本語で返す", async (props) => {
  const invalid = await props.request.post("/api/trpc/order.create", {
    headers: { "x-demo-user": "demo-customer" },
    data: { service: "customer", lines: [] },
  });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).error.message).toBe(
    "入力内容が不正です。入力内容を確認してください",
  );

  const forbidden = await props.request.post("/api/trpc/order.create", {
    headers: { "x-demo-role": "member" },
    data: {
      service: "business",
      lines: [{ sku: "SKU-EDGE-MUG", name: "Edge Mug", quantity: 1, unitPrice: 2400 }],
    },
  });
  expect(forbidden.status()).toBe(403);
  expect((await forbidden.json()).error.data.code).toBe("FORBIDDEN");

  const missingImage = await props.request.get("/api/trpc/product.getImage", {
    params: { input: JSON.stringify({ id: crypto.randomUUID(), service: "business" }) },
  });
  expect(missingImage.status()).toBe(404);
  const imageError = (await missingImage.json()).error;
  expect(imageError.message).toBe("商品が見つかりません");
  expect(imageError.data.code).toBe("NOT_FOUND");

  const missingApi = await props.request.get("/api/missing");
  expect(missingApi.status()).toBe(404);
  expect(await missingApi.json()).toEqual({ error: "APIが見つかりません", code: "NOT_FOUND" });
});
