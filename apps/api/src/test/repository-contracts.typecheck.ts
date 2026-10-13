import type { D1PaymentRepository } from "#api/infrastructure/payment/repositories/d1-payment-repository.ts";
import type { D1StockAdjustmentRepository } from "#api/infrastructure/inventory/repositories/d1-stock-adjustment-repository.ts";
import type { ProductImageStore } from "#api/application/product/storage/product-image-store.ts";
import type { D1ProductImageStore } from "#api/infrastructure/product/storage/d1-product-image-store.ts";
import type { OrganizationRelationsRepository } from "#api/domain/access/repositories/organization-relations-repository.ts";
import type { MembershipEntity } from "#api/domain/access/entities/membership.ts";
import type { OrganizationEntity } from "#api/domain/access/entities/organization.ts";
import type { InvitationEntity } from "#api/domain/access/entities/invitation.ts";
import type { PlanAssignment } from "#api/domain/access/entities/plan-assignment.ts";
import type { StockBalanceRepository } from "#api/domain/inventory/repositories/stock-balance-repository.ts";
import type { StockBalance } from "#api/domain/inventory/entities/stock-balance.ts";
import type { StoreProductDto } from "#api/application/store/dtos/store-product-dto.ts";
import type { ManagedStockDto } from "#api/application/inventory/dtos/managed-stock-output.ts";
import type { InventoryReadRepository } from "#api/domain/inventory/repositories/inventory-read-repository.ts";
import type { PaymentStateRepository } from "#api/domain/payment/repositories/payment-state-repository.ts";
import type { PaymentState } from "#api/domain/payment/entities/payment-state.ts";
import type { StockAdjustmentRepository } from "#api/domain/inventory/repositories/stock-adjustment-repository.ts";
import type { StockAdjustmentEntry } from "#api/domain/inventory/entities/stock-adjustment-entry.ts";
import type { StockHistoryEntryDto } from "#api/application/inventory/dtos/stock-history-output.ts";
import type { OrganizationRepository } from "#api/domain/access/repositories/organization-repository.ts";
import type {
  AccessReadRepository,
  ServiceAccount,
} from "#api/domain/access/repositories/access-read-repository.ts";
import type { AccessAuditEntry } from "#api/domain/access/entities/access-audit-entry.ts";
import type { OrganizationDirectoryItemDto } from "#api/application/access/dtos/organization-directory-output.ts";
import type { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";
import type { StockReservationEntity } from "#api/domain/inventory/entities/stock-reservation.ts";
import type { InventoryRepository } from "#api/domain/inventory/repositories/inventory-repository.ts";
import type { D1DoInventoryRepository } from "#api/infrastructure/inventory/repositories/d1-do-inventory-repository.ts";
import type { InventoryStockRow } from "#api/infrastructure/inventory/shared/d1-inventory-ledger.ts";
import type { D1ProductRepository } from "#api/infrastructure/product/repositories/d1-product-repository.ts";
import type { D1OrderRepository } from "#api/infrastructure/order/repositories/d1-order-repository.ts";
import type { D1AccessRepository } from "#api/infrastructure/access/repositories/d1-access-repository.ts";
// Repositoryの取得・保存契約をコンパイル時に固定する。本番からは参照しない。
import type { Product } from "#api/domain/product/entities/product.ts";
import type { ProductRepository } from "#api/domain/product/repositories/product-repository.ts";
import type { Order } from "#api/domain/order/entities/order.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import type { Payment } from "#api/domain/payment/entities/payment.ts";
import type { PaymentRepository } from "#api/domain/payment/repositories/payment-repository.ts";
import type {
  AccessRepository,
  AccessRecords,
} from "#api/domain/access/repositories/access-repository.ts";
import type { ProductListItemDto } from "#api/application/product/dtos/product-output.ts";
import type { OrderListItemDto } from "#api/application/order/dtos/order-output.ts";

type Assert<T extends true> = T;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Assignable<A, B> = [A] extends [B] ? true : false;

export type RepositoryContracts = [
  Assert<Equal<Parameters<InventoryRepository["saveAdjustment"]>[0], InventoryItem>>,
  Assert<Equal<Parameters<InventoryRepository["saveAdjustment"]>[1], StockAdjustmentEntry>>,
  Assert<
    Equal<Awaited<ReturnType<StockAdjustmentRepository["find"]>>, StockAdjustmentEntry | null>
  >,
  Assert<Equal<keyof D1StockAdjustmentRepository, keyof StockAdjustmentRepository>>,
  Assert<Equal<Parameters<ProductRepository["attachImage"]>[0], Product>>,
  Assert<Equal<Parameters<ProductRepository["removeImage"]>[0], Product>>,
  Assert<Equal<keyof ProductImageStore, "stageImage">>,
  Assert<Equal<keyof D1ProductImageStore, keyof ProductImageStore>>,
  Assert<Equal<keyof D1PaymentRepository, keyof PaymentRepository>>,
  Assert<Equal<keyof PaymentRepository, "save">>,
  Assert<Equal<Awaited<ReturnType<OrganizationRepository["findMany"]>>, OrganizationEntity[]>>,
  Assert<
    Equal<Awaited<ReturnType<OrganizationRelationsRepository["members"]>>, MembershipEntity[]>
  >,
  Assert<Equal<Awaited<ReturnType<OrganizationRelationsRepository["plans"]>>, PlanAssignment[]>>,
  Assert<Equal<Awaited<ReturnType<StockBalanceRepository["findForProducts"]>>, StockBalance[]>>,
  Assert<Equal<Assignable<StoreProductDto, Product>, false>>,
  Assert<Equal<Assignable<ManagedStockDto, InventoryItem>, false>>,
  Assert<Equal<Awaited<ReturnType<InventoryReadRepository["find"]>>, InventoryItem>>,
  Assert<Equal<Awaited<ReturnType<InventoryReadRepository["findMany"]>>, InventoryItem[]>>,
  Assert<Equal<Awaited<ReturnType<PaymentStateRepository["findForOrders"]>>, PaymentState[]>>,
  Assert<Equal<Awaited<ReturnType<StockAdjustmentRepository["history"]>>, StockAdjustmentEntry[]>>,
  Assert<Equal<Awaited<ReturnType<OrganizationRepository["list"]>>, OrganizationEntity[]>>,
  Assert<Equal<Awaited<ReturnType<AccessReadRepository["findAccount"]>>, ServiceAccount | null>>,
  Assert<Equal<Awaited<ReturnType<AccessReadRepository["audit"]>>, AccessAuditEntry[]>>,
  Assert<Equal<Assignable<OrganizationDirectoryItemDto, OrganizationEntity>, false>>,
  Assert<Equal<Assignable<StockHistoryEntryDto, StockAdjustmentEntry>, false>>,
  Assert<Equal<Assignable<{ id: string; status: string }, PaymentState>, false>>,
  Assert<Equal<Awaited<ReturnType<ProductRepository["listPublic"]>>, Product[]>>,
  Assert<Equal<Awaited<ReturnType<OrderRepository["listForCustomer"]>>, Order[]>>,
  Assert<Equal<Awaited<ReturnType<OrderRepository["findForCustomer"]>>, Order | null>>,
  Assert<Equal<Awaited<ReturnType<D1DoInventoryRepository["find"]>>, InventoryItem | null>>,
  Assert<Equal<keyof D1DoInventoryRepository, keyof InventoryRepository>>,
  Assert<Equal<Parameters<InventoryRepository["save"]>[0], InventoryItem>>,
  Assert<
    Equal<
      Parameters<InventoryRepository["restoreAllocation"]>[0],
      StockReservationEntity<"restored">
    >
  >,
  Assert<Equal<Assignable<InventoryStockRow, InventoryItem>, false>>,
  Assert<Equal<Awaited<ReturnType<D1ProductRepository["find"]>>, Product | null>>,
  Assert<Equal<Awaited<ReturnType<D1OrderRepository["find"]>>, Order | null>>,
  Assert<Equal<Awaited<ReturnType<D1AccessRepository["findInvitation"]>>, InvitationEntity | null>>,
  Assert<Equal<Awaited<ReturnType<D1AccessRepository["load"]>>, AccessRecords>>,
  Assert<Equal<keyof D1ProductRepository, keyof ProductRepository>>,
  Assert<Equal<keyof D1OrderRepository, keyof OrderRepository>>,
  Assert<Equal<keyof D1AccessRepository, keyof AccessRepository>>,
  Assert<
    Equal<
      keyof ProductRepository,
      | "register"
      | "attachImage"
      | "removeImage"
      | "updateDetails"
      | "find"
      | "list"
      | "findBySkus"
      | "listPublic"
    >
  >,
  Assert<Equal<Parameters<ProductRepository["register"]>[0], Product>>,
  Assert<Equal<Awaited<ReturnType<ProductRepository["list"]>>, Product[]>>,
  Assert<Equal<Awaited<ReturnType<ProductRepository["findBySkus"]>>, Product[]>>,
  Assert<Equal<Parameters<ProductRepository["updateDetails"]>[0], Product>>,
  Assert<Equal<Awaited<ReturnType<ProductRepository["find"]>>, Product | null>>,
  Assert<
    Equal<
      keyof OrderRepository,
      "save" | "find" | "update" | "list" | "findForCustomer" | "listForCustomer"
    >
  >,
  Assert<Equal<Awaited<ReturnType<OrderRepository["list"]>>, Order[]>>,
  Assert<Equal<Parameters<OrderRepository["save"]>[0], Order>>,
  Assert<Equal<Parameters<OrderRepository["update"]>[0], Order>>,
  Assert<Equal<Awaited<ReturnType<OrderRepository["find"]>>, Order | null>>,
  Assert<Equal<Parameters<PaymentRepository["save"]>[0], Payment>>,
  Assert<Equal<keyof AccessRepository, "load" | "commit" | "findInvitation">>,
  Assert<Equal<Awaited<ReturnType<AccessRepository["load"]>>, AccessRecords>>,
  Assert<Equal<Awaited<ReturnType<AccessRepository["findInvitation"]>>, InvitationEntity | null>>,
  Assert<Equal<Assignable<ProductListItemDto, Product>, false>>,
  Assert<Equal<Assignable<OrderListItemDto, Order>, false>>,
];
