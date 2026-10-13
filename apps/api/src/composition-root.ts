import { OrderPaymentSynchronizationGateway } from "#api/infrastructure/payment/gateways/order-payment-synchronizer.ts";
import { DurableInventoryReadRepository } from "#api/infrastructure/inventory/repositories/durable-inventory-read-repository.ts";
import { D1AccessReadRepository } from "#api/infrastructure/access/repositories/d1-access-read-repository.ts";
import { D1ProductRepository } from "#api/infrastructure/product/repositories/d1-product-repository.ts";
import { D1ProductImageStore } from "#api/infrastructure/product/storage/d1-product-image-store.ts";
import { D1ProductImageCleanupStore } from "#api/infrastructure/product/storage/d1-product-image-cleanup-store.ts";
import { D1AccessQuery } from "#api/infrastructure/access/queries/d1-access-query.ts";
import { D1AccessAuditStore } from "#api/infrastructure/access/stores/d1-access-audit-store.ts";
import { D1OrderStatusRepository } from "#api/infrastructure/order/repositories/d1-order-status-repository.ts";
import { D1PaymentStateRepository } from "#api/infrastructure/payment/repositories/d1-payment-state-repository.ts";
import { D1OutboxStore } from "#api/infrastructure/order/messaging/d1-outbox-store.ts";
import { ListOrganizationDirectoryUseCase } from "#api/application/access/use-cases/list-organization-directory-use-case.ts";
import { D1OrganizationRelationsRepository } from "#api/infrastructure/access/repositories/d1-organization-relations-repository.ts";
import { InventoryOverviewUseCase } from "#api/application/inventory/use-cases/inventory-overview-use-case.ts";
import { D1StockAdjustmentRepository } from "#api/infrastructure/inventory/repositories/d1-stock-adjustment-repository.ts";
import { CreateProductUseCase } from "#api/application/product/use-cases/create-product-use-case.ts";
import { ManageStockUseCase } from "#api/application/inventory/use-cases/manage-stock-use-case.ts";
import { StoreUseCase } from "#api/application/store/use-cases/store-use-case.ts";
import { D1OrganizationRepository } from "#api/infrastructure/access/repositories/d1-organization-repository.ts";
import { D1StockBalanceRepository } from "#api/infrastructure/inventory/repositories/d1-stock-balance-repository.ts";
import { DashboardUseCase } from "#api/application/dashboard/use-cases/dashboard-use-case.ts";
import { GetOrderUseCase } from "#api/application/order/use-cases/get-order-use-case.ts";
import { AccessUseCases } from "#api/application/access/use-cases/access-use-cases.ts";
import { PlanAccessQuery } from "#api/application/access/queries/plan-access-query.ts";
import { D1AccessRepository } from "#api/infrastructure/access/repositories/d1-access-repository.ts";
import { AccountIdentityProvider } from "#api/application/auth/providers/account-identity-provider.ts";
import { ProcessOrderEventUseCase } from "#api/application/order/use-cases/process-order-event-use-case.ts";
import { SynchronizePaymentUseCase } from "#api/application/payment/use-cases/synchronize-payment-use-case.ts";
import { D1PaymentRepository } from "#api/infrastructure/payment/repositories/d1-payment-repository.ts";
import type { ApplicationContainer } from "#api/application/container.ts";
import { env } from "cloudflare:workers";
import { ProductUseCases } from "#api/application/product/use-cases/product-use-cases.ts";
import { CleanupProductImagesUseCase } from "#api/application/product/use-cases/cleanup-product-images-use-case.ts";
import { R2ProductImageStorage } from "#api/infrastructure/product/storage/r2-product-image-storage.ts";
import { ClerkIdentityProvider } from "#api/infrastructure/auth/providers/clerk-identity-provider.ts";
import { DemoIdentityProvider } from "#api/infrastructure/auth/providers/demo-identity-provider.ts";
import { CreateOrderUseCase } from "#api/application/order/use-cases/create-order-use-case.ts";
import { ManageOrderUseCase } from "#api/application/order/use-cases/manage-order-use-case.ts";
import { ListOrdersUseCase } from "#api/application/order/use-cases/list-orders-use-case.ts";
import type { IdentityProvider } from "#api/application/auth/providers/identity-provider.ts";
import { PublishOutboxUseCase } from "#api/application/order/use-cases/publish-outbox-use-case.ts";
import { D1OrderRepository } from "#api/infrastructure/order/repositories/d1-order-repository.ts";
import { InventoryDurableObjectGateway } from "#api/infrastructure/order/gateways/inventory-do-gateway.ts";
import { QueueEventPublisher } from "#api/infrastructure/order/messaging/queue-event-publisher.ts";

function createIdentityProvider(): IdentityProvider {
  if (env.AUTH_MODE === "clerk") {
    if (!env.CLERK_SECRET_KEY) {
      throw new Error("CLERK_SECRET_KEY is required when AUTH_MODE=clerk");
    }

    if (!env.CLERK_AUTHORIZED_PARTIES.split(",").some((value) => value.trim())) {
      throw new Error("CLERK_AUTHORIZED_PARTIESを設定してください");
    }

    return new ClerkIdentityProvider(
      env.CLERK_SECRET_KEY,
      env.CLERK_AUTHORIZED_PARTIES.split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }

  // デモ用ヘッダーを本番の本人確認に使わせないため、接続時に環境を制限する。
  if (env.APP_ENV !== "local") {
    throw new Error("デモ認証はローカル環境でのみ利用できます");
  }

  return new DemoIdentityProvider();
}

export function createContainer(): ApplicationContainer {
  const orders = new D1OrderRepository(env.DB);
  const statuses = new D1OrderStatusRepository(env.DB);
  const paymentStates = new D1PaymentStateRepository(env.DB);
  const inventory = new InventoryDurableObjectGateway(
    env.INVENTORY_RESERVATIONS,
    env.TENANT_INVENTORY_RESERVATIONS,
    env.LEGACY_INVENTORY_TENANT_ID,
  );

  const access = new D1AccessRepository(env.DB);
  // D1は会員・所属・ロール・プランコードの事実を返すだけにし、
  // 通信境界の認可にプラン適用済みQueryを使い、UseCaseにはEntity読取Repositoryを渡す。
  const products = new D1ProductRepository(env.DB);
  const inventoryReader = inventoryReadRepository();
  const productImages = new R2ProductImageStorage(env.PRODUCT_IMAGES);
  const createOrder = new CreateOrderUseCase(orders, inventory, products);
  const manageOrder = new ManageOrderUseCase(orders, inventory, products);
  return {
    ...catalogUseCases(
      products,
      orders,
      statuses,
      paymentStates,
      productImages,
      createOrder,
      manageOrder,
    ),
    getOrder: new GetOrderUseCase(orders, paymentStates, statuses),
    access: accessUseCases(access),
    accessRepository: access,
    identityProvider: new AccountIdentityProvider(createIdentityProvider(), accessPolicy()),
    products: new ProductUseCases(products, productImages, new D1ProductImageStore(env.DB)),
    createProduct: new CreateProductUseCase(products),
    inventoryOverview: new InventoryOverviewUseCase(
      new D1StockAdjustmentRepository(env.DB),
      products,
      inventoryReader,
    ),
    manageStock: new ManageStockUseCase(products, inventory, inventoryReader),
    cleanupProductImages: new CleanupProductImagesUseCase(
      new D1ProductImageCleanupStore(env.DB),
      productImages,
    ),
    createOrder,
    manageOrder,
    listOrders: new ListOrdersUseCase(orders, paymentStates, statuses),
    publishOutbox: new PublishOutboxUseCase(
      new D1OutboxStore(env.DB),
      new QueueEventPublisher(env.ORDER_EVENTS),
    ),
  };
}

// Queueの処理は利用者向け認可経路と分け、配送された環境のバインディングを使う。
export function createOrderEventProcessor(environment: Env): ProcessOrderEventUseCase {
  return new ProcessOrderEventUseCase(
    new D1OrderRepository(environment.DB),
    new InventoryDurableObjectGateway(
      environment.INVENTORY_RESERVATIONS,
      environment.TENANT_INVENTORY_RESERVATIONS,
      environment.LEGACY_INVENTORY_TENANT_ID,
    ),
    new OrderPaymentSynchronizationGateway(
      new SynchronizePaymentUseCase(new D1PaymentRepository(environment.DB)),
    ),
  );
}

function storeUseCase(
  products: D1ProductRepository,
  orders: D1OrderRepository,
  statuses: D1OrderStatusRepository,
  payments: D1PaymentStateRepository,
  images: R2ProductImageStorage,
  createOrder: CreateOrderUseCase,
  manageOrder: ManageOrderUseCase,
) {
  return new StoreUseCase(
    {
      products,
      orders,
      statuses,
      payments,
      organizations: new D1OrganizationRepository(env.DB),
      stock: new D1StockBalanceRepository(env.DB),
    },
    images,
    createOrder,
    manageOrder,
  );
}

function accessPolicy() {
  return new PlanAccessQuery(new D1AccessQuery(env.DB));
}

function accessUseCases(repository: D1AccessRepository) {
  return new AccessUseCases(
    repository,
    new D1AccessReadRepository(env.DB),
    new D1AccessAuditStore(env.DB),
  );
}

function catalogUseCases(
  products: D1ProductRepository,
  orders: D1OrderRepository,
  statuses: D1OrderStatusRepository,
  payments: D1PaymentStateRepository,
  images: R2ProductImageStorage,
  createOrder: CreateOrderUseCase,
  manageOrder: ManageOrderUseCase,
) {
  return {
    organizationDirectory: new ListOrganizationDirectoryUseCase(
      new D1OrganizationRepository(env.DB),
      new D1OrganizationRelationsRepository(env.DB),
    ),
    store: storeUseCase(products, orders, statuses, payments, images, createOrder, manageOrder),
    dashboard: new DashboardUseCase(
      orders,
      products,
      new D1OrganizationRelationsRepository(env.DB),
    ),
  };
}

function inventoryReadRepository() {
  return new DurableInventoryReadRepository(
    env.INVENTORY_RESERVATIONS,
    env.TENANT_INVENTORY_RESERVATIONS,
    env.LEGACY_INVENTORY_TENANT_ID,
  );
}
