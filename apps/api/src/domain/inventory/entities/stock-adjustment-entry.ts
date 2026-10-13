import { z } from "zod";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { STOCK_ADJUSTMENT_REASONS } from "#api/domain/inventory/policies/stock-adjustment.ts";

const schema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
  sku: z.unknown().transform(Sku.create),
  operation: z.enum(["initial", "receive", "recount"]),
  reason: z.enum([
    "initial",
    ...STOCK_ADJUSTMENT_REASONS.receive,
    ...STOCK_ADJUSTMENT_REASONS.recount,
  ]),
  quantity: z.unknown().transform(StockQuantity.create),
  beforeStock: z.unknown().transform(StockQuantity.create),
  afterStock: z.unknown().transform(StockQuantity.create),
  expectedStock: z
    .unknown()
    .transform((value) => (value === null ? null : StockQuantity.create(value))),
  createdAt: z.union([z.iso.datetime({ offset: true }), z.iso.date()]),
  actorName: z.string().min(1).nullable(),
});

const metadataSchema = schema.pick({
  id: true,
  tenantId: true,
  actorId: true,
  operation: true,
  reason: true,
  createdAt: true,
});

export type StockAdjustmentSnapshot = z.infer<typeof schema>;

/** 変更履歴の識別子と数量を検証して復元し、入荷・初期化・棚卸しの数量関係を保持する。 */
export class StockAdjustmentEntry {
  private constructor(private readonly data: StockAdjustmentSnapshot) {
    Object.freeze(this.data);
    Object.freeze(this);
  }

  static restore(value: unknown) {
    const row = schema.parse(value);
    return StockAdjustmentEntry.fromSnapshot(row);
  }

  /** 新しい履歴は検証済みの数量を受け取り、表示時点の担当者名を保存しない。 */
  static create(value: Omit<StockAdjustmentSnapshot, "actorName">): StockAdjustmentEntry {
    // 識別子・日時はブランド型ではないため、保存後にも同じ契約で復元できる形を確認する。
    const metadata = metadataSchema.parse(value);
    return StockAdjustmentEntry.fromSnapshot({ ...value, ...metadata, actorName: null });
  }

  private static fromSnapshot(row: StockAdjustmentSnapshot): StockAdjustmentEntry {
    const expectedAfter =
      row.operation === "receive" ? row.beforeStock + row.quantity : row.quantity;
    if (
      row.afterStock !== expectedAfter ||
      (row.operation === "initial" && row.beforeStock !== 0)
    ) {
      throw new Error("在庫変更履歴の数量関係が不正です");
    }

    return new StockAdjustmentEntry(row);
  }

  get id() {
    return this.data.id;
  }

  toSnapshot() {
    return { ...this.data };
  }
}
