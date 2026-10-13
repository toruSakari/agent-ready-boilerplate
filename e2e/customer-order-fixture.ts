import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";
import { z } from "zod";

/** 企業は商品だけを準備し、注文は独立した一般ユーザーとして作成する。 */
export async function createCustomerOrder(
  request: APIRequestContext,
  lines: { sku: string; name: string; quantity: number; unitPrice: number }[],
  options: { draft?: boolean; organizationId?: string; user?: string; initialStock?: number } = {},
) {
  const organizationId = options.organizationId ?? "demo-store";
  for (const line of lines) {
    const product = await request.post("/api/trpc/product.create", {
      headers: { "x-demo-user": "demo-user", "x-organization-id": organizationId },
      data: {
        sku: line.sku,
        name: line.name,
        unitPrice: line.unitPrice,
        initialStock: options.initialStock ?? 20,
      },
    });
    expect(product.status()).toBe(200);
  }

  const response = await request.post("/api/trpc/order.create", {
    headers: {
      "x-demo-user": options.user ?? "demo-customer",
      "x-organization-id": organizationId,
    },
    data: { service: "customer", draft: options.draft, lines },
  });
  expect(response.status()).toBe(200);
  return z
    .object({ result: z.object({ data: z.object({ id: z.string(), version: z.number() }) }) })
    .parse(await response.json()).result.data;
}
