import type { OrderFilters } from "#api/domain/shared/list-filters.ts";
import type { PageRequest } from "#api/domain/shared/page-request.ts";
import type { Order } from "#api/domain/order/entities/order.ts";

/** save/updateは作成・変更時のイベントを持つ注文を受け取る。復元しただけの注文は保存対象にしない。 */
export interface OrderRepository {
  listForCustomer(customerId: string, page: PageRequest, filters?: OrderFilters): Promise<Order[]>;
  findForCustomer(customerId: string, id: string): Promise<Order | null>;
  list(
    tenantId: string,
    customerId?: string,
    page?: PageRequest,
    filters?: OrderFilters,
  ): Promise<Order[]>;
  /** 注文と今回のドメインイベントを、配信待ちの意図を含めて原子的に保存する。 */
  save(order: Order): Promise<void>;
  /** テナントを限定し、保存データを検証して復元済みの注文を返す。 */
  find(tenantId: string, id: string): Promise<Order | null>;
  /** 読取時の版と一致する場合だけ注文とイベントを保存し、競合時はfalseを返す。 */
  update(order: Order, expectedVersion: number): Promise<boolean>;
}
