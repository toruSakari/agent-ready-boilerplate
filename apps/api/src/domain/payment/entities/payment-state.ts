import { z } from "zod";

const schema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  orderVersion: z.number().int().nonnegative(),
  status: z.enum(["pending", "authorized", "captured", "failed", "voided"]),
});

/** 注文同期で保存された決済状態。外部決済の失敗理由や課金の操作を推測しない。 */
export class PaymentState {
  declare private readonly identityBrand: void;

  private constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly orderId: string,
    readonly orderVersion: number,
    readonly status: z.infer<typeof schema>["status"],
  ) {
    Object.freeze(this);
  }

  static restore(this: void, value: unknown) {
    const row = schema.parse(value);
    return new PaymentState(row.id, row.tenantId, row.orderId, row.orderVersion, row.status);
  }
}
