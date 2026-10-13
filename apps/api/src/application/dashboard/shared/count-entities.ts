import type { ProductRepository } from "#api/domain/product/repositories/product-repository.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import type { PageCursor } from "#api/domain/shared/page-request.ts";

export async function countProducts(repository: Pick<ProductRepository, "list">, tenantId: string) {
  let cursor: PageCursor | undefined;
  let total = 0;
  while (true) {
    const products = await repository.list(tenantId, { limit: 100, cursor });
    total += products.length;
    const last = products.at(-1);
    if (products.length < 100 || !last) {
      return total;
    }

    cursor = { id: last.id, createdAt: last.createdAt };
  }
}

export async function countOrders(repository: Pick<OrderRepository, "list">, tenantId: string) {
  let cursor: PageCursor | undefined;
  let total = 0,
    draft = 0,
    confirmed = 0;
  while (true) {
    const orders = await repository.list(tenantId, undefined, { limit: 100, cursor });
    for (const order of orders) {
      total++;
      if (order.status === "draft") {
        draft++;
      }

      if (order.status === "confirmed") {
        confirmed++;
      }
    }

    const last = orders.at(-1)?.toSnapshot();
    if (orders.length < 100 || !last) {
      return { total, draft, confirmed };
    }

    cursor = { id: last.id, createdAt: last.createdAt };
  }
}
