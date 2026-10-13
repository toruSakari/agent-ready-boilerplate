import { CreateOrderInputDto } from "#api/application/order/dtos/create-order-input-dto.ts";
import { ManageOrderInputDto } from "#api/application/order/dtos/manage-order-input-dto.ts";
import { StoreListOutputDto } from "#api/application/store/dtos/store-list-output-dto.ts";
import { StoreGetOutputDto } from "#api/application/store/dtos/store-get-output-dto.ts";
import { StoreGetImageOutputDto } from "#api/application/store/dtos/store-get-image-output-dto.ts";
import { StoreCheckoutOutputDto } from "#api/application/store/dtos/store-checkout-output-dto.ts";
import { StoreListOrdersOutputDto } from "#api/application/store/dtos/store-list-orders-output-dto.ts";
import { StoreCancelOrderOutputDto } from "#api/application/store/dtos/store-cancel-order-output-dto.ts";
import { StoreGetOrderInputDto } from "#api/application/store/dtos/store-get-order-input-dto.ts";
import { StoreGetOrderOutputDto } from "#api/application/store/dtos/store-get-order-output-dto.ts";
import type { StoreListInputDto } from "#api/application/store/dtos/store-list-input-dto.ts";
import type { StoreGetInputDto } from "#api/application/store/dtos/store-get-input-dto.ts";
import type { StoreGetImageInputDto } from "#api/application/store/dtos/store-get-image-input-dto.ts";
import type { StoreCheckoutInputDto } from "#api/application/store/dtos/store-checkout-input-dto.ts";
import type { StoreListOrdersInputDto } from "#api/application/store/dtos/store-list-orders-input-dto.ts";
import type { StoreCancelOrderInputDto } from "#api/application/store/dtos/store-cancel-order-input-dto.ts";
import type { ManageOrderUseCase } from "#api/application/order/use-cases/manage-order-use-case.ts";
import type { ProductRepository } from "#api/domain/product/repositories/product-repository.ts";
import type { OrganizationRepository } from "#api/domain/access/repositories/organization-repository.ts";
import type { StockBalanceRepository } from "#api/domain/inventory/repositories/stock-balance-repository.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import type { OrderStatusRepository } from "#api/domain/order/repositories/order-status-repository.ts";
import type { PaymentStateRepository } from "#api/domain/payment/repositories/payment-state-repository.ts";
import { presentStoreProducts } from "#api/application/store/mappers/present-store-products.ts";
import { presentOrders } from "#api/application/order/mappers/present-orders.ts";
import type { PageCursor } from "#api/domain/shared/page-request.ts";

import type { ProductImageStorage } from "#api/application/product/storage/product-image-storage.ts";
import type { CreateOrderUseCase } from "#api/application/order/use-cases/create-order-use-case.ts";
import type { AuthorizedActor } from "#api/application/auth/contracts/authorized-actor.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

type StoreRepositories = {
  products: Pick<ProductRepository, "listPublic" | "findBySkus">;
  organizations: Pick<OrganizationRepository, "findMany">;
  stock: StockBalanceRepository;
  orders: Pick<OrderRepository, "listForCustomer" | "findForCustomer">;
  statuses: OrderStatusRepository;
  payments: PaymentStateRepository;
};

function pageResult<
  T extends {
    createdAt: string;
    id: string;
  },
>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor: PageCursor | null =
    rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null;
  return { items, nextCursor };
}

export class StoreUseCase {
  constructor(
    private readonly repositories: StoreRepositories,
    private readonly images: ProductImageStorage,
    private readonly createOrder: CreateOrderUseCase,
    private readonly manageOrder: ManageOrderUseCase,
  ) {}

  async list(inputDto: StoreListInputDto): Promise<StoreListOutputDto> {
    const { page, search, filters } = inputDto;
    const entities = await this.repositories.products.listPublic(page, search, filters);
    const result = pageResult(entities, page.limit);
    return StoreListOutputDto.parse({
      ...result,
      items: await presentStoreProducts(
        result.items,
        this.repositories.organizations,
        this.repositories.stock,
      ),
    });
  }

  async get(inputDto: StoreGetInputDto): Promise<StoreGetOutputDto> {
    const { tenantId, sku } = inputDto;
    const products = await this.repositories.products.findBySkus(tenantId, [sku]);
    const [item] = await presentStoreProducts(
      products,
      this.repositories.organizations,
      this.repositories.stock,
    );
    if (!item) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    }

    return StoreGetOutputDto.parse(item);
  }

  async getImage(inputDto: StoreGetImageInputDto): Promise<StoreGetImageOutputDto> {
    const { tenantId, sku, imageId } = inputDto;
    const [product] = await this.repositories.products.findBySkus(tenantId, [sku]);
    const [seller] = product ? await this.repositories.organizations.findMany([tenantId]) : [];
    const key =
      product && seller?.active
        ? product.images.find((image) =>
            imageId ? image.id === imageId : image.key === product.imageKey,
          )?.key
        : null;
    const image = key ? await this.images.get(key) : null;
    if (!image) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "商品画像が見つかりません" });
    }

    return StoreGetImageOutputDto.parse(image);
  }

  private assertCustomer(identity: AuthorizedActor) {
    if (identity.channel !== "customer" || identity.tenantId || identity.purpose) {
      throw new ApplicationError({ code: "FORBIDDEN", message: "通常会員の本人確認が必要です" });
    }
  }

  async checkout(inputDto: StoreCheckoutInputDto): Promise<StoreCheckoutOutputDto> {
    const { identity, tenantId, lines } = inputDto;
    this.assertCustomer(identity);
    // 所属の代わりに販売対象の公開商品を確認。単価照合と在庫予約は既存注文ユースケースが担う。
    const [seller] = await this.repositories.organizations.findMany([tenantId]);
    const products = await this.repositories.products.findBySkus(
      tenantId,
      lines.map((line) => line.sku),
    );
    const available = new Set(products.map((product) => String(product.sku)));
    if (!seller?.active || lines.some((line) => !available.has(line.sku))) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    }

    return StoreCheckoutOutputDto.parse(
      await this.createOrder.execute(
        CreateOrderInputDto.parse({ identity: { ...identity, tenantId }, lines, draft: false }),
      ),
    );
  }

  async listOrders(inputDto: StoreListOrdersInputDto): Promise<StoreListOrdersOutputDto> {
    const { identity, page, filters } = inputDto;
    this.assertCustomer(identity);
    const entities = await this.repositories.orders.listForCustomer(identity.userId, page, filters);
    const result = pageResult(
      entities.map((order) => order.toSnapshot()),
      page.limit,
    );
    return StoreListOrdersOutputDto.parse({
      ...result,
      items: await presentOrders(
        entities.slice(0, page.limit),
        this.repositories.payments,
        this.repositories.statuses,
      ),
    });
  }

  async cancelOrder(inputDto: StoreCancelOrderInputDto): Promise<StoreCancelOrderOutputDto> {
    const { identity, id, version } = inputDto;
    // 販売企業が停止していても本人の既存注文は取り消せる。公開商品・企業所属を要求しない。
    const order = await this.getOrder(StoreGetOrderInputDto.parse({ identity, id }));
    return StoreCancelOrderOutputDto.parse(
      await this.manageOrder.execute(
        ManageOrderInputDto.parse({
          input: {
            identity: { ...identity, tenantId: order.tenantId },
            id,
            version,
            status: "cancelled",
          },
        }),
      ),
    );
  }

  async getOrder(inputDto: StoreGetOrderInputDto): Promise<StoreGetOrderOutputDto> {
    const { identity, id } = inputDto;
    this.assertCustomer(identity);
    const order = await this.repositories.orders.findForCustomer(identity.userId, id);
    if (!order) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "注文が見つかりません" });
    }

    return StoreGetOrderOutputDto.parse(
      (await presentOrders([order], this.repositories.payments, this.repositories.statuses))[0]!,
    );
  }
}
