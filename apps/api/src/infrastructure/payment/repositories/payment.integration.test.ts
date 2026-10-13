// @vitest-environment node
import { beforeAll, afterAll, beforeEach, expect, it } from "vite-plus/test";
import { getPlatformProxy } from "wrangler";
import { fileURLToPath } from "node:url";
import { PaymentEntity } from "#api/domain/payment/entities/payment.ts";
import { PaymentAmount } from "#api/domain/payment/value-objects/payment-amount.ts";
import { CurrencyCode } from "#api/domain/payment/value-objects/currency-code.ts";
import { D1PaymentRepository } from "#api/infrastructure/payment/repositories/d1-payment-repository.ts";
import { migrateTestDatabase } from "#api/test/migrate-test-database.ts";

let platform: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
let repository: D1PaymentRepository;
const now = "2026-10-04T00:00:00.000Z";
beforeAll(async () => {
  platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath: fileURLToPath(
      new URL("../../access/repositories/wrangler.access-test.jsonc", import.meta.url),
    ),
    persist: false,
  });
  await migrateTestDatabase(platform.env.DB);
  repository = new D1PaymentRepository(platform.env.DB);
}, 30_000);
afterAll(async () => {
  await platform?.dispose();
});
beforeEach(async () => {
  await platform.env.DB.prepare("DELETE FROM payments").run();
});

function payment(amount = 100, orderId = "order") {
  return PaymentEntity.initiate({
    id: "payment",
    orderId,
    amount: PaymentAmount.create(amount),
    currency: CurrencyCode.create("JPY"),
    now,
    eventId: crypto.randomUUID(),
  });
}

function saved() {
  return platform.env.DB.prepare(
    "SELECT tenant_id, order_id, amount, order_version, status FROM payments WHERE id = 'payment'",
  ).first();
}

it("古い版と同じ版の再送は保存状態を巻き戻さず、新しい版だけを保存する", async () => {
  await repository.save(payment(300), "shop", 3);
  await repository.save(payment(100), "shop", 1);
  await repository.save(payment(999), "shop", 3);
  expect(await saved()).toMatchObject({ amount: 300, order_version: 3 });
  await repository.save(payment(400), "shop", 4);
  expect(await saved()).toMatchObject({ amount: 400, order_version: 4 });
});
it("並行保存でも注文の最新の版を保持する", async () => {
  await Promise.all([
    repository.save(payment(300), "shop", 3),
    repository.save(payment(100), "shop", 1),
    repository.save(payment(200), "shop", 2),
  ]);
  expect(await saved()).toMatchObject({ amount: 300, order_version: 3 });
});
it.each([
  { tenant: "foreign", order: "order" },
  { tenant: "shop", order: "other" },
])("同じ決済IDの別企業・別注文への移動を拒否する: %j", async (input) => {
  const { tenant, order } = input;
  await repository.save(payment(), "shop", 1);
  await expect(repository.save(payment(999, order), tenant, 2)).rejects.toThrow("所有関係");
  expect(await saved()).toEqual({
    tenant_id: "shop",
    order_id: "order",
    amount: 100,
    order_version: 1,
    status: "pending",
  });
});
it("保存障害では版を進めず、再試行で同じEntityを保存できる", async () => {
  await repository.save(payment(), "shop", 1);
  await platform.env.DB.prepare(
    "CREATE TRIGGER reject_payment BEFORE UPDATE ON payments BEGIN SELECT RAISE(ABORT, 'test failure'); END",
  ).run();
  try {
    await expect(repository.save(payment(200), "shop", 2)).rejects.toThrow();
  } finally {
    await platform.env.DB.prepare("DROP TRIGGER reject_payment").run();
  }

  expect(await saved()).toMatchObject({ amount: 100, order_version: 1 });
  await repository.save(payment(200), "shop", 2);
  expect(await saved()).toMatchObject({ amount: 200, order_version: 2 });
});
