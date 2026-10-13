import type { OrderSnapshot } from "#api/domain/order/entities/order.ts";
import { orderValues } from "#api/test/domain-values.ts";
import { invokeRuntime } from "#api/test/invoke-runtime.ts";
import { describe, expect, it } from "vite-plus/test";
import { OrderEntity } from "#api/domain/order/entities/order.ts";

describe("注文エンティティ（OrderEntity）", () => {
  it("注文を作成してドメインイベントを記録する", () => {
    const order = OrderEntity.place(
      orderValues({
        id: "order-1",
        tenantId: "tenant-1",
        customerId: "customer-1",
        lines: [{ sku: "SKU-1", name: "Edge Mug", quantity: 2, unitPrice: 2400 }],
        now: "2026-09-30T00:00:00.000Z",
        eventId: "event-1",
      }),
    );

    expect(order.total).toBe(4800);
    expect(order.status).toBe("confirmed");
    expect(order.events).toEqual([
      expect.objectContaining({
        name: "order.placed",
        aggregateId: "order-1",
      }),
    ]);
  });

  it("明細のない注文を拒否する", () => {
    expect(() =>
      OrderEntity.place(
        orderValues({
          id: "order-1",
          tenantId: "tenant-1",
          customerId: "customer-1",
          lines: [],
          now: "2026-09-30T00:00:00.000Z",
          eventId: "event-1",
        }),
      ),
    ).toThrow("注文明細は1件以上20件以下にしてください");
  });
});

const creation = {
  id: "o1",
  tenantId: "t1",
  customerId: "u1",
  lines: [{ sku: "s1", name: "マグ", quantity: 1, unitPrice: 500 }],
  now: "2026-10-02",
  eventId: "e1",
};
const event = { now: "2026-10-03", eventId: "e2" };

describe("Orderの状態型と復元", () => {
  it("新しいエンティティで状態を進め、元のエンティティは変更しない", () => {
    const draft = OrderEntity.draft(orderValues(creation));
    const confirmed = draft.confirm(event);
    const completed = confirmed.ship(event).complete(event);
    expect(draft.status).toBe("draft");
    expect(confirmed.status).toBe("confirmed");
    expect(completed.status).toBe("completed");
    expect(Object.isFrozen(completed)).toBe(true);

    expect(() => invokeRuntime(completed, "cancel", [event])).toThrow(
      "出荷前の注文だけをキャンセルできます",
    );
  });

  it("復元結果を状態で絞ってから操作できる", () => {
    const restored = restoreOrderFixture(OrderEntity.draft(orderValues(creation)).toSnapshot());
    if (restored.status !== "draft") {
      throw new Error("想定と異なる状態です");
    }

    expect(restored.confirm(event).status).toBe("confirmed");
  });
});

// TypeScriptを通さない呼出しを再現する。本番コードでは先に状態で共用型を絞る。
function uncheckedOrderAction(
  order: import("#api/domain/order/entities/order.ts").Order,
  target: "confirmed" | "shipped" | "completed" | "cancelled",
) {
  switch (target) {
    case "confirmed":
      return invokeRuntime(order, "confirm", [event]);
    case "shipped":
      return invokeRuntime(order, "ship", [event]);
    case "completed":
      return invokeRuntime(order, "complete", [event]);
    case "cancelled":
      return invokeRuntime(order, "cancel", [event]);
  }
}

const orderStates = ["draft", "confirmed", "shipped", "completed", "cancelled"] as const;
const orderTargets = ["confirmed", "shipped", "completed", "cancelled"] as const;
const allowedOrderEdges = new Set([
  "draft:confirmed",
  "draft:cancelled",
  "confirmed:shipped",
  "confirmed:cancelled",
  "shipped:completed",
]);
it.each(orderStates.flatMap((source) => orderTargets.map((target) => [source, target] as const)))(
  "注文の全遷移 %s → %s を検証する",
  (source, target) => {
    const order = restoreOrderFixture({
      ...OrderEntity.place(orderValues(creation)).toSnapshot(),
      status: source,
      reservationId: source === "draft" ? null : "r1",
    });
    if (allowedOrderEdges.has(`${source}:${target}`)) {
      const next = uncheckedOrderAction(order, target);
      expect(next).toMatchObject({ status: target, version: order.version + 1 });
      expect(order.status).toBe(source);
    } else {
      expect(() => uncheckedOrderAction(order, target)).toThrow();
    }
  },
);

it("明細と内部の値オブジェクトを変更できず、保存用の値とは分離する", () => {
  const draft = OrderEntity.draft(orderValues(creation));
  const line = draft.lines[0];
  if (!line) {
    throw new Error("明細がありません");
  }

  expect(Object.isFrozen(draft.lines)).toBe(true);
  expect(Object.isFrozen(line)).toBe(true);
  expect(Reflect.set(line, "quantity", 99)).toBe(false);
  const snapshot = draft.toSnapshot();
  snapshot.lines[0] = { ...creation.lines[0]!, quantity: 99 };
  expect(draft.lines[0]?.quantity).toBe(1);
  expect(draft.total).toBe(500);
});

function restoreOrderFixture(value: OrderSnapshot) {
  return OrderEntity.restore(orderValues(value));
}
