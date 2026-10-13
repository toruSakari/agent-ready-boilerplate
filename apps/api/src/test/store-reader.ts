import { StoreGetInputDto } from "#api/application/store/dtos/store-get-input-dto.ts";
import { StoreListOrdersInputDto } from "#api/application/store/dtos/store-list-orders-input-dto.ts";
import { StoreGetOrderInputDto } from "#api/application/store/dtos/store-get-order-input-dto.ts";
import { StoreUseCase } from "#api/application/store/use-cases/store-use-case.ts";
import { CreateOrderUseCase } from "#api/application/order/use-cases/create-order-use-case.ts";
import { ManageOrderUseCase } from "#api/application/order/use-cases/manage-order-use-case.ts";
import { D1ProductRepository } from "#api/infrastructure/product/repositories/d1-product-repository.ts";
import { D1OrderRepository } from "#api/infrastructure/order/repositories/d1-order-repository.ts";
import { D1OrderStatusRepository } from "#api/infrastructure/order/repositories/d1-order-status-repository.ts";
import { D1PaymentStateRepository } from "#api/infrastructure/payment/repositories/d1-payment-state-repository.ts";
import { D1OrganizationRepository } from "#api/infrastructure/access/repositories/d1-organization-repository.ts";
import { D1StockBalanceRepository } from "#api/infrastructure/inventory/repositories/d1-stock-balance-repository.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";

export function storeRepositories(db: D1Database) {
  return {
    products: new D1ProductRepository(db),
    orders: new D1OrderRepository(db),
    statuses: new D1OrderStatusRepository(db),
    payments: new D1PaymentStateRepository(db),
    organizations: new D1OrganizationRepository(db),
    stock: new D1StockBalanceRepository(db),
  };
}

export function storeReader(db: D1Database) {
  const repositories = storeRepositories(db);
  const unavailable = async () => {
    throw new Error("読取テストでは在庫操作を呼べません");
  };
  const gateway = {
    reserve: unavailable,
    release: unavailable,
    cancel: unavailable,
    commit: unavailable,
  };
  const store = new StoreUseCase(
    repositories,
    { get: async () => null, put: unavailable, delete: unavailable },
    new CreateOrderUseCase(repositories.orders, gateway, repositories.products),
    new ManageOrderUseCase(repositories.orders, gateway, repositories.products),
  );
  return {
    list: store.list.bind(store),
    get: async (tenantId: string, sku: string) => {
      return optionalResult(() => store.get(StoreGetInputDto.parse({ tenantId, sku })));
    },
    imageKey: (tenantId: string, sku: string, imageId?: string) =>
      publicImageKey(repositories, tenantId, sku, imageId),
    listOrders: async (
      customerId: string,
      page: import("#api/domain/shared/page-request.ts").PageRequest,
      filters?: import("#api/domain/shared/list-filters.ts").OrderFilters,
    ) =>
      await store.listOrders(
        StoreListOrdersInputDto.parse({ identity: await identity(customerId), page, filters }),
      ),
    getOrder: async (customerId: string, id: string) => {
      return optionalResult(async () =>
        store.getOrder(StoreGetOrderInputDto.parse({ identity: await identity(customerId), id })),
      );
    },
  };
}

function identity(userId: string) {
  return authorizedActor({
    userId,
    tenantId: "",
    channel: "customer",
    role: "member",
    permissions: [],
  });
}

async function publicImageKey(
  repositories: ReturnType<typeof storeRepositories>,
  tenantId: string,
  sku: string,
  imageId?: string,
) {
  const [product] = await repositories.products.findBySkus(tenantId, [sku]);
  const [seller] = product ? await repositories.organizations.findMany([tenantId]) : [];
  return product && seller?.active
    ? (product.images.find((image) =>
        imageId ? image.id === imageId : image.key === product.imageKey,
      )?.key ?? null)
    : null;
}

async function optionalResult<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "NOT_FOUND") {
      return null;
    }

    throw error;
  }
}
