import { z } from "zod";
import { ORDER_STATUS_CODES } from "#api/domain/order/policies/order-status.ts";

const schema = z.object({ id: z.enum(ORDER_STATUS_CODES), name: z.string().min(1) });

/** 状態マスターの識別子と名称。注文そのものの状態遷移とは分離する。 */
export class OrderStatusEntity {
  declare private readonly identityBrand: void;

  private constructor(
    readonly id: z.infer<typeof schema>["id"],
    readonly name: string,
  ) {
    Object.freeze(this);
  }

  static restore(this: void, value: unknown) {
    const row = schema.parse(value);
    return new OrderStatusEntity(row.id, row.name);
  }
}
