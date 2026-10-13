import { Product } from "#api/domain/product/entities/product.ts";
import { StoreCheckoutInputDto } from "#api/application/store/dtos/store-checkout-input-dto.ts";
import { StoreListOrdersInputDto } from "#api/application/store/dtos/store-list-orders-input-dto.ts";
import { StoreGetOrderInputDto } from "#api/application/store/dtos/store-get-order-input-dto.ts";
import { StoreGetImageInputDto } from "#api/application/store/dtos/store-get-image-input-dto.ts";
import { ManageOrderUseCase } from "#api/application/order/use-cases/manage-order-use-case.ts";
import { expect, it, vi } from "vite-plus/test";
import { StoreUseCase } from "#api/application/store/use-cases/store-use-case.ts";

import { productValues } from "#api/test/domain-values.ts";
import { OrganizationEntity } from "#api/domain/access/entities/organization.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { CreateOrderUseCase } from "#api/application/order/use-cases/create-order-use-case.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";

const product = {
  id: "p",
  tenantId: "seller",
  sku: "mug",
  name: "カップ",
  organizationName: "販売店",
  unitPrice: 100,
  availableQuantity: 10,
  images: [],
  createdAt: "2026-10-10T00:00:00.000Z",
};

async function setup(price = 100) {
  const actor = await authorizedActor({
    userId: "customer:buyer",
    tenantId: "",
    channel: "customer",
    role: "member",
    permissions: [],
  });
  const query = repositoryFixture(price);
  const orders = { save: vi.fn(), find: vi.fn().mockResolvedValue(null), update: vi.fn() };
  const inventory = { reserve: vi.fn(), release: vi.fn(), cancel: vi.fn(), commit: vi.fn() };
  const create = new CreateOrderUseCase(orders, inventory, {
    findBySkus: vi.fn().mockResolvedValue([
      {
        id: "mug",
        tenantId: "seller-a",
        imageKey: null,
        images: [],
        createdAt: "2026-10-01",
        sku: Sku.create("mug"),
        name: ProductName.create("カップ"),
        unitPrice: UnitPrice.create(price),
      },
    ]),
  });
  const images = { get: vi.fn(), put: vi.fn(), delete: vi.fn() };
  return {
    actor,
    query,
    orders,
    inventory,
    images,
    store: new StoreUseCase(
      query,
      images,
      create,
      new ManageOrderUseCase(orders, inventory, { findBySkus: vi.fn() }),
    ),
  };
}

it("一般購入者ストア / 企業所属のない会員が公開商品の販売企業へ注文できる", async () => {
  const { store, actor, orders, inventory } = await setup();
  const order = await store.checkout(
    StoreCheckoutInputDto.parse({
      identity: actor,
      tenantId: "seller",
      lines: [{ sku: "mug", name: "送信名", quantity: 2, unitPrice: 100 }],
    }),
  );
  expect(order).toMatchObject({ tenantId: "seller", customerId: "customer:buyer", total: 200 });
  expect(order.lines[0]?.name).toBe("カップ");
  expect(orders.save).toHaveBeenCalledOnce();
  expect(inventory.reserve).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: "seller", sku: "mug" }),
  );
});
it("一般購入者ストア / 有料商品の0円改ざんを在庫予約・保存前に拒否", async () => {
  const { store, actor, orders, inventory } = await setup();
  await expect(
    store.checkout(
      StoreCheckoutInputDto.parse({
        identity: actor,
        tenantId: "seller",
        lines: [{ sku: "mug", name: "カップ", quantity: 1, unitPrice: 0 }],
      }),
    ),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(inventory.reserve).not.toHaveBeenCalled();
  expect(orders.save).not.toHaveBeenCalled();
});
it("一般購入者ストア / 無料商品は0円で購入できる", async () => {
  const { store, actor } = await setup(0);
  expect(
    (
      await store.checkout(
        StoreCheckoutInputDto.parse({
          identity: actor,
          tenantId: "seller",
          lines: [{ sku: "mug", name: "カップ", quantity: 1, unitPrice: 0 }],
        }),
      )
    ).total,
  ).toBe(0);
});
it("一般購入者ストア / 非公開商品は予約前に拒否する", async () => {
  const { store, actor, query, inventory } = await setup();
  query.products.findBySkus.mockResolvedValue([]);
  await expect(
    store.checkout(
      StoreCheckoutInputDto.parse({
        identity: actor,
        tenantId: "disabled",
        lines: [{ sku: "mug", name: "カップ", quantity: 1, unitPrice: 100 }],
      }),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(inventory.reserve).not.toHaveBeenCalled();
});
it("一般購入者ストア / 本人履歴には対象企業でなく会員IDを渡し他人の注文は404", async () => {
  const { store, actor, query } = await setup();
  await store.listOrders(StoreListOrdersInputDto.parse({ identity: actor, page: { limit: 25 } }));
  expect(query.orders.listForCustomer).toHaveBeenCalledWith(
    "customer:buyer",
    { limit: 25 },
    undefined,
  );
  await expect(
    store.getOrder(StoreGetOrderInputDto.parse({ identity: actor, id: "another-order" })),
  ).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(query.orders.findForCustomer).toHaveBeenCalledWith("customer:buyer", "another-order");
});
it("一般購入者ストア / 公開参照のない画像キーをストレージへ渡さない", async () => {
  const { store, images, query } = await setup();
  query.products.findBySkus.mockResolvedValue([]);
  await expect(
    store.getImage(
      StoreGetImageInputDto.parse({ tenantId: "seller", sku: "mug", imageId: "private" }),
    ),
  ).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(images.get).not.toHaveBeenCalled();
});

function repositoryFixture(price: number) {
  const products = {
    findBySkus: vi
      .fn()
      .mockResolvedValue([
        Product.restore(productValues({ ...product, unitPrice: price, imageKey: null })),
      ]),
    listPublic: vi.fn(),
  };
  return {
    products,
    organizations: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          new OrganizationEntity(
            AccessId.create("seller"),
            AccessName.create("販売店"),
            true,
            false,
          ),
        ]),
    },
    stock: { findForProducts: vi.fn() },
    orders: {
      listForCustomer: vi.fn().mockResolvedValue([]),
      findForCustomer: vi.fn().mockResolvedValue(null),
    },
    statuses: { list: vi.fn() },
    payments: { findForOrders: vi.fn() },
  };
}
