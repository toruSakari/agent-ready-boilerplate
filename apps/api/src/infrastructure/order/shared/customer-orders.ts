import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  orders,
  orderStatuses,
  orderStatusAssignments,
} from "#api/infrastructure/order/schemas/schema.ts";
import { cursorPagination } from "#api/infrastructure/shared/cursor-pagination.ts";
import { orderConditions } from "#api/infrastructure/shared/list-conditions.ts";
import { restoreStoredOrder } from "#api/infrastructure/order/mappers/restore-stored-order.ts";
import type { PageRequest } from "#api/domain/shared/page-request.ts";
import type { OrderFilters } from "#api/domain/shared/list-filters.ts";

export async function customerOrders(
  db: DrizzleD1Database,
  customerId: string,
  page: PageRequest,
  filters: OrderFilters = {},
  id?: string,
) {
  const cursor = cursorPagination(orders, page.cursor, filters.sort);
  const rows = await db
    .select({ order: orders, status: orderStatuses.code })
    .from(orders)
    .innerJoin(orderStatusAssignments, eq(orderStatusAssignments.ordersId, orders.id))
    .innerJoin(orderStatuses, eq(orderStatuses.code, orderStatusAssignments.orderStatusesId))
    .where(
      and(
        eq(orders.customerId, customerId),
        id ? eq(orders.id, id) : undefined,
        cursor.after,
        orderConditions(
          { id: orders.id, createdAt: orders.createdAt, status: orderStatuses.code },
          filters,
        ),
      ),
    )
    .orderBy(...cursor.order)
    .limit(id ? 1 : page.limit + 1);
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
