import { test, expect } from "@/e2e/fixtures";
import { z } from "zod";

const orderResponse = z.object({
  result: z.object({
    data: z.object({
      total: z.number(),
      lines: z.array(z.object({ name: z.string(), unitPrice: z.number() })),
    }),
  }),
});

test("顧客の価格改ざんは拒否し、無料商品は0円で注文できる", async (props) => {
  const headers = { "x-demo-user": "demo-customer", "x-organization-id": "demo-store" };
  const paidSku = `PAID-${crypto.randomUUID()}`;
  expect(
    (
      await props.request.post("/api/trpc/product.create", {
        data: { sku: paidSku, name: "有料の商品", unitPrice: 2400 },
      })
    ).status(),
  ).toBe(200);
  const created = await props.request.post("/api/trpc/order.create", {
    headers,
    data: {
      service: "customer",
      draft: true,
      lines: [{ sku: paidSku, name: "改ざん", quantity: 2, unitPrice: 0 }],
    },
  });
  expect(created.status()).toBe(400);
  const valid = await props.request.post("/api/trpc/order.create", {
    headers,
    data: {
      service: "customer",
      draft: true,
      lines: [{ sku: paidSku, name: "入力の商品名", quantity: 2, unitPrice: 2400 }],
    },
  });
  expect(valid.status()).toBe(200);
  const paid = orderResponse.parse(await valid.json()).result.data;
  expect(paid.total).toBe(4800);
  expect(paid.lines[0]).toEqual({ name: "有料の商品", unitPrice: 2400 });

  const sku = `FREE-${crypto.randomUUID()}`;
  expect(
    (
      await props.request.post("/api/trpc/product.create", {
        data: { sku, name: "無料の商品", unitPrice: 0 },
      })
    ).status(),
  ).toBe(200);
  const free = await props.request.post("/api/trpc/order.create", {
    headers,
    data: {
      service: "customer",
      draft: true,
      lines: [{ sku, name: "入力の商品名", quantity: 1, unitPrice: 0 }],
    },
  });
  expect(free.status()).toBe(200);
  expect(orderResponse.parse(await free.json()).result.data.total).toBe(0);
});
