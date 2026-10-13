import type { ProductRepository } from "#api/domain/product/repositories/product-repository.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { orderOperation } from "#api/application/order/errors/order-operation.ts";
import { OrderLine } from "#api/domain/order/entities/order-line.ts";
import { createOrderLine } from "#api/application/order/mappers/create-order-line.ts";
import type { OrderLineSnapshot } from "#api/domain/order/entities/order-line.ts";

/** 顧客の単価と現在の商品価格の一致を検証し、商品から購入時点の明細を確定する。 */
export async function priceCustomerOrderLines(
  products: Pick<ProductRepository, "findBySkus">,
  tenantId: string,
  input: readonly OrderLineSnapshot[],
): Promise<OrderLine[]> {
  const lines = orderOperation(() => input.map(createOrderLine));
  const found = await products.findBySkus(tenantId, [...new Set(lines.map((line) => line.sku))]);
  const catalog = new Map(found.map((product) => [product.sku, product]));
  return lines.map((line) => {
    const product = catalog.get(line.sku);
    if (!product) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    }

    if (line.unitPrice !== product.unitPrice) {
      throw new ApplicationError({
        code: "BAD_REQUEST",
        message: "商品の価格が一致しません。商品情報を再読み込みしてください",
      });
    }

    return new OrderLine(line.sku, product.name, line.quantity, product.unitPrice);
  });
}
