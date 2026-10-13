import { z } from "zod";
import {
  stockAdjustmentSchema,
  adjustedStock,
} from "#api/domain/inventory/policies/stock-adjustment.ts";
import { StockOperationId } from "#api/domain/inventory/value-objects/stock-operation-id.ts";
import type { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";
import type { InventoryRepository } from "#api/domain/inventory/repositories/inventory-repository.ts";
import type { StockAdjustmentRepository } from "#api/domain/inventory/repositories/stock-adjustment-repository.ts";
import { StockAdjustmentEntry } from "#api/domain/inventory/entities/stock-adjustment-entry.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { StockAdjustmentInput } from "#api/application/inventory/dtos/stock-adjustment-input.ts";

const schema = z
  .object({
    operationId: z.uuid(),
    sku: z.string().min(1),
    actorId: z.string().min(1),
    adjustment: stockAdjustmentSchema,
  })
  .strict();

/** 認可済みの内部要求だけを扱う。比較・履歴保存は予約と同じDOの排他区間内で行う。 */
export async function adjustStock(
  request: Request,
  tenantId: string,
  inventory: Pick<InventoryRepository, "saveAdjustment">,
  adjustments: Pick<StockAdjustmentRepository, "find">,
  load: (sku: string) => Promise<InventoryItem>,
) {
  const { adjustment, ...metadata } = schema.parse(await request.json());
  const input = StockAdjustmentInput.parse({ ...metadata, ...adjustment, tenantId });
  const previous = await adjustments.find(tenantId, input.operationId);
  if (previous && !sameOperation(previous, input)) {
    return Response.json({ reason: "STOCK_OPERATION_CONFLICT" }, { status: 409 });
  }

  const current = await load(input.sku);
  // 保存後に応答が途切れた再試行でも、現在の在庫を二重に加算しない。
  if (previous) {
    return snapshot(current);
  }

  if (input.operation === "recount" && input.expectedStock !== current.onHand) {
    return Response.json({ reason: "STOCK_CHANGED" }, { status: 409 });
  }

  const onHand = adjustedStock(current.onHand, adjustment);
  if (onHand < current.reserved) {
    return Response.json({ reason: "STOCK_RESERVED" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const item = current.changeStock({
    onHand,
    now,
    eventId: StockOperationId.create(input.operationId),
  });
  await inventory.saveAdjustment(item, createAdjustment(input, current, item, now));
  return snapshot(item);
}

function createAdjustment(
  input: StockAdjustmentInput,
  current: InventoryItem,
  item: InventoryItem,
  now: string,
): StockAdjustmentEntry {
  return StockAdjustmentEntry.create({
    id: input.operationId,
    tenantId: input.tenantId,
    sku: item.sku,
    actorId: input.actorId,
    operation: input.operation,
    reason: input.reason,
    quantity: StockQuantity.create(input.quantity),
    beforeStock: current.onHand,
    afterStock: item.onHand,
    expectedStock: input.operation === "recount" ? StockQuantity.create(input.expectedStock) : null,
    createdAt: now,
  });
}

function sameOperation(entry: StockAdjustmentEntry, input: StockAdjustmentInput) {
  const record = entry.toSnapshot();
  return (
    record.sku === input.sku &&
    record.actorId === input.actorId &&
    record.operation === input.operation &&
    record.reason === input.reason &&
    record.quantity === input.quantity &&
    record.expectedStock === (input.operation === "recount" ? input.expectedStock : null)
  );
}

function snapshot(item: InventoryItem) {
  return Response.json({ stock: item.onHand, reserved: item.reserved, available: item.available });
}
