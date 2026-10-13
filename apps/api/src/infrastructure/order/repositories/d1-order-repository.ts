import { customerOrders } from "#api/infrastructure/order/shared/customer-orders.ts";
import { cursorPagination } from "#api/infrastructure/shared/cursor-pagination.ts";
import { orderConditions } from "#api/infrastructure/shared/list-conditions.ts";
import { pageRequest } from "#api/application/shared/pagination.ts";
import type { PageRequest } from "#api/domain/shared/page-request.ts";
import type { OrderFilters } from "#api/domain/shared/list-filters.ts";
import { guardedInsert } from "#api/infrastructure/shared/guarded-insert.ts";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, exists } from "drizzle-orm";
import {
  orders,
  outboxEvents,
  orderStatuses,
  orderStatusAssignments,
} from "#api/infrastructure/order/schemas/schema.ts";
import { restoreStoredOrder } from "#api/infrastructure/order/mappers/restore-stored-order.ts";
import type { OrderSnapshot, Order } from "#api/domain/order/entities/order.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";

export class D1OrderRepository implements OrderRepository {
  private readonly database;

  constructor(binding: D1Database) {
    this.database = drizzle(binding);
  }

  listForCustomer(customerId: string, page: PageRequest, filters?: OrderFilters) {
    return customerOrders(this.database, customerId, page, filters);
  }

  async findForCustomer(customerId: string, id: string) {
    return (await customerOrders(this.database, customerId, { limit: 1 }, {}, id))[0] ?? null;
  }

  async save(order: Order): Promise<void> {
    const snapshot = order.toSnapshot();
    const statements = [
      this.database.insert(orders).values({
        id: snapshot.id,
        tenantId: snapshot.tenantId,
        customerId: snapshot.customerId,
        lines: JSON.stringify(snapshot.lines),
        total: snapshot.total,
        createdAt: snapshot.createdAt,
        version: snapshot.version,
        reservationId: snapshot.reservationId,
      }),
      this.database.insert(orderStatusAssignments).values({
        ordersId: snapshot.id,
        orderStatusesId: snapshot.status,
        updatedAt: order.events[0]!.occurredAt,
      }),
      ...order.events.map((event) =>
        this.database.insert(outboxEvents).values({
          id: event.id,
          aggregateId: event.aggregateId,
          eventType: event.name,
          payload: JSON.stringify(event),
          occurredAt: event.occurredAt,
        }),
      ),
    ] as const;

    // 注文・現在状態・送信意図を原子的に保存し、注文だけ確定してイベントが失われるのを防ぐ。
    await this.database.batch(statements);
  }

  async find(tenantId: string, id: string): Promise<Order | null> {
    const [row] = await this.database
      .select({ order: orders, status: orderStatuses.code })
      .from(orders)
      .innerJoin(orderStatusAssignments, eq(orderStatusAssignments.ordersId, orders.id))
      .innerJoin(orderStatuses, eq(orderStatuses.code, orderStatusAssignments.orderStatusesId))
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)))
      .limit(1);
    if (!row) {
      return null;
    }

    return restoreStoredOrder({
      id: row.order.id,
      tenantId: row.order.tenantId,
      customerId: row.order.customerId,
      status: row.status,
      lines: JSON.parse(row.order.lines),
      total: row.order.total,
      createdAt: row.order.createdAt,
      version: row.order.version,
      // 旧確定注文は注文IDを予約IDとしていたため、予約IDの保存値がない場合だけその対応を復元する。
      reservationId:
        row.order.reservationId ??
        (["confirmed", "shipped", "completed"].includes(row.status) ? row.order.id : null),
    });
  }

  async list(
    tenantId: string,
    customerId?: string,
    page?: PageRequest,
    filters: OrderFilters = {},
  ): Promise<Order[]> {
    const pagination = pageRequest(page);
    const cursor = cursorPagination(orders, pagination.cursor, filters.sort);
    const rows = await this.database
      .select({ order: orders, status: orderStatuses.code })
      .from(orders)
      .innerJoin(orderStatusAssignments, eq(orderStatusAssignments.ordersId, orders.id))
      .innerJoin(orderStatuses, eq(orderStatuses.code, orderStatusAssignments.orderStatusesId))
      .where(
        and(
          eq(orders.tenantId, tenantId),
          customerId ? eq(orders.customerId, customerId) : undefined,
          cursor.after,
          orderConditions(
            { id: orders.id, createdAt: orders.createdAt, status: orderStatuses.code },
            filters,
          ),
        ),
      )
      .orderBy(...cursor.order)
      .limit(pagination.limit);
    return rows.map((props) =>
      restoreStoredOrder({
        ...props.order,
        status: props.status,
        lines: JSON.parse(props.order.lines),
        reservationId:
          props.order.reservationId ??
          (["confirmed", "shipped", "completed"].includes(props.status) ? props.order.id : null),
      }),
    );
  }

  async update(order: Order, expectedVersion: number): Promise<boolean> {
    const snapshot = order.toSnapshot();
    const event = order.events[0]!;
    // D1の原子的なバッチ内で、版比較に勝った注文のイベントIDだけが状態・Outboxを更新する。
    const winner = exists(
      this.database
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.id, snapshot.id),
            eq(orders.tenantId, snapshot.tenantId),
            eq(orders.lastEventId, event.id),
          ),
        ),
    );
    const [updated] = await this.database.batch([
      this.updateRecord(snapshot, expectedVersion, event.id),
      this.database
        .update(orderStatusAssignments)
        .set({ orderStatusesId: snapshot.status, updatedAt: event.occurredAt })
        .where(and(eq(orderStatusAssignments.ordersId, snapshot.id), winner)),
      guardedInsert(
        this.database,
        outboxEvents,
        {
          id: event.id,
          aggregateId: event.aggregateId,
          eventType: event.name,
          payload: JSON.stringify(event),
          occurredAt: event.occurredAt,
        },
        winner,
      ),
    ]);
    return updated.length === 1;
  }

  /** 版比較と現在状態の存在を同じUPDATE内で確認し、勝者をRETURNINGで返す。 */
  private updateRecord(snapshot: OrderSnapshot, expectedVersion: number, eventId: string) {
    return this.database
      .update(orders)
      .set({
        lines: JSON.stringify(snapshot.lines),
        total: snapshot.total,
        version: snapshot.version,
        reservationId: snapshot.reservationId,
        lastEventId: eventId,
      })
      .where(
        and(
          eq(orders.id, snapshot.id),
          eq(orders.tenantId, snapshot.tenantId),
          eq(orders.version, expectedVersion),
          exists(
            this.database
              .select({ id: orderStatusAssignments.ordersId })
              .from(orderStatusAssignments)
              .where(eq(orderStatusAssignments.ordersId, orders.id)),
          ),
        ),
      )
      .returning({ id: orders.id });
  }
}
