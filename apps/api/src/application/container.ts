import { ListOrganizationDirectoryUseCase } from "#api/application/access/use-cases/list-organization-directory-use-case.ts";
import type { InventoryOverviewUseCase } from "#api/application/inventory/use-cases/inventory-overview-use-case.ts";
import type { CreateProductUseCase } from "#api/application/product/use-cases/create-product-use-case.ts";
import type { ManageStockUseCase } from "#api/application/inventory/use-cases/manage-stock-use-case.ts";
import type { StoreUseCase } from "#api/application/store/use-cases/store-use-case.ts";
import type { DashboardUseCase } from "#api/application/dashboard/use-cases/dashboard-use-case.ts";
import type { GetOrderUseCase } from "#api/application/order/use-cases/get-order-use-case.ts";
import type { AccessRepository } from "#api/domain/access/repositories/access-repository.ts";
import type { AccessUseCases } from "#api/application/access/use-cases/access-use-cases.ts";
import type { ServiceIdentityProvider } from "#api/application/auth/providers/service-identity-provider.ts";
import type { ProductUseCases } from "#api/application/product/use-cases/product-use-cases.ts";
import type { CleanupProductImagesUseCase } from "#api/application/product/use-cases/cleanup-product-images-use-case.ts";
import type { CreateOrderUseCase } from "#api/application/order/use-cases/create-order-use-case.ts";
import type { ManageOrderUseCase } from "#api/application/order/use-cases/manage-order-use-case.ts";
import type { ListOrdersUseCase } from "#api/application/order/use-cases/list-orders-use-case.ts";
import type { PublishOutboxUseCase } from "#api/application/order/use-cases/publish-outbox-use-case.ts";

/** Composition Rootが接続した実装の束。UseCaseの操作を別インターフェースへ重複定義しない。 */
export type ApplicationContainer = {
  organizationDirectory: ListOrganizationDirectoryUseCase;
  store: StoreUseCase;
  dashboard: DashboardUseCase;
  getOrder: GetOrderUseCase;
  access: AccessUseCases;
  accessRepository: AccessRepository;
  identityProvider: ServiceIdentityProvider;
  products: ProductUseCases;
  createProduct: CreateProductUseCase;
  manageStock: ManageStockUseCase;
  inventoryOverview: InventoryOverviewUseCase;
  cleanupProductImages: CleanupProductImagesUseCase;
  createOrder: CreateOrderUseCase;
  manageOrder: ManageOrderUseCase;
  listOrders: ListOrdersUseCase;
  publishOutbox: PublishOutboxUseCase;
};
