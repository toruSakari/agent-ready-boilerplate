import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { InvalidOrderError } from "#api/domain/order/errors/invalid-order-error.ts";
import { InvalidOrderTransitionError } from "#api/domain/order/errors/invalid-order-transition-error.ts";

// 利用者入力・状態遷移の既知エラーだけを変換し、DB等の予期しない障害を400で隠さない。
export function orderOperation<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof InvalidOrderError || error instanceof InvalidValueObjectError) {
      throw new ApplicationError({ code: "BAD_REQUEST", message: error.message });
    }

    if (error instanceof InvalidOrderTransitionError) {
      throw new ApplicationError({ code: "CONFLICT", message: error.message });
    }

    throw error;
  }
}
