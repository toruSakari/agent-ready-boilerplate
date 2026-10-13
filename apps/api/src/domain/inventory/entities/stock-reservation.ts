import { InvalidReservationError } from "#api/domain/inventory/errors/invalid-reservation-error.ts";
import { InvalidReservationTransitionError } from "#api/domain/inventory/errors/invalid-reservation-transition-error.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { ReservationQuantity } from "#api/domain/inventory/value-objects/reservation-quantity.ts";
import { isNonEmptyString } from "#api/domain/shared/validation.ts";

export type ReservationStatus = "reserved" | "committed" | "released" | "restored";

export type ReservationSnapshot<S extends ReservationStatus = ReservationStatus> = Readonly<{
  orderId: string;
  sku: string;
  quantity: number;
  status: S;
}>;

type ReservationData<S extends ReservationStatus = ReservationStatus> = Omit<
  ReservationSnapshot<S>,
  "sku" | "quantity"
> & { sku: Sku; quantity: ReservationQuantity };

export type ReservationRestoration = Readonly<ReservationData>;

export type StockReservation = {
  [S in ReservationStatus]: StockReservationEntity<S>;
}[ReservationStatus];

/** 予約中の解放と、確定後の在庫復元を別の遷移として扱う不変な予約。 */
export class StockReservationEntity<S extends ReservationStatus> {
  // 状態ごとの型を区別し、各操作のthis制約で許可されない遷移を拒否する。
  declare private readonly stateBrand: S;
  readonly orderId: string;
  readonly sku: Sku;
  readonly quantity: ReservationQuantity;
  readonly status: S;

  private constructor(snapshot: ReservationData<S>) {
    this.orderId = snapshot.orderId;
    this.sku = snapshot.sku;
    this.quantity = snapshot.quantity;
    this.status = snapshot.status;
    Object.freeze(this);
  }

  static reserve(input: {
    orderId: string;
    sku: Sku;
    quantity: ReservationQuantity;
  }): StockReservationEntity<"reserved"> {
    if (!isNonEmptyString(input.orderId)) {
      throw new InvalidReservationError("在庫予約のIDが不正です");
    }

    return new StockReservationEntity({ ...input, status: "reserved" });
  }

  /** 保存形式と単一値の検証はアダプター側で済ませ、復元時にはイベントを発生させない。 */
  static restore(snapshot: ReservationRestoration): StockReservation {
    switch (snapshot.status) {
      case "reserved":
        return new StockReservationEntity({ ...snapshot, status: "reserved" });
      case "committed":
        return new StockReservationEntity({ ...snapshot, status: "committed" });
      case "released":
        return new StockReservationEntity({ ...snapshot, status: "released" });
      case "restored":
        return new StockReservationEntity({ ...snapshot, status: "restored" });
    }
  }

  commit(this: StockReservationEntity<"reserved">): StockReservationEntity<"committed"> {
    if (this.status !== "reserved") {
      throw new InvalidReservationTransitionError("予約中の在庫だけを確定できます");
    }

    return new StockReservationEntity({ ...this.data(), status: "committed" });
  }

  release(this: StockReservationEntity<"reserved">): StockReservationEntity<"released"> {
    if (this.status !== "reserved") {
      throw new InvalidReservationTransitionError("予約中の在庫だけを解放できます");
    }

    return new StockReservationEntity({ ...this.data(), status: "released" });
  }

  restoreStock(this: StockReservationEntity<"committed">): StockReservationEntity<"restored"> {
    if (this.status !== "committed") {
      throw new InvalidReservationTransitionError("確定済みの在庫だけを復元できます");
    }

    return new StockReservationEntity({ ...this.data(), status: "restored" });
  }

  toReference(): { orderId: string; quantity: number } {
    return { orderId: this.orderId, quantity: this.quantity };
  }

  private data(): ReservationData<S> {
    return { orderId: this.orderId, sku: this.sku, quantity: this.quantity, status: this.status };
  }

  toSnapshot(): ReservationSnapshot<S> {
    return { ...this.data(), sku: this.sku, quantity: this.quantity };
  }
}
