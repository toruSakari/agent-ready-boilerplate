import { parseInputDto } from "#api/application/shared/parse-input-dto.ts";
import { CreateOrderInputDto } from "#api/application/order/dtos/create-order-input-dto.ts";
import { ListOrdersInputDto } from "#api/application/order/dtos/list-orders-input-dto.ts";
import { ManageOrderInputDto } from "#api/application/order/dtos/manage-order-input-dto.ts";
import { GetOrderInputDto } from "#api/application/order/dtos/get-order-input-dto.ts";
import { orderFiltersSchema } from "#api/domain/shared/list-filters.ts";
import { paginationSchema } from "#api/application/shared/pagination.ts";
import { requireBusinessIp } from "#api/presentation/shared/middleware/business-ip-restriction.ts";
import { SKU_LIMITS } from "#api/domain/shared/value-objects/sku.ts";
import { PRODUCT_NAME_LIMITS } from "#api/domain/shared/value-objects/product-name.ts";
import { UNIT_PRICE_LIMITS } from "#api/domain/shared/value-objects/unit-price.ts";
import { ORDER_QUANTITY_LIMITS } from "#api/domain/order/value-objects/order-quantity.ts";
import { ORDER_LINE_LIMITS } from "#api/domain/order/entities/order.ts";
import { z } from "zod";
import { t, procedure } from "#api/presentation/shared/trpc-core.ts";
import {
  requireActor,
  requirePermissions,
} from "#api/presentation/shared/middleware/trpc-authorization.ts";

// 通信境界でもドメイン所有の上限を参照し、入力形式と業務制約の数値をずらさない。
const lineSchema = z.object({
  sku: z.string().trim().min(SKU_LIMITS.minLength).max(SKU_LIMITS.maxLength),
  name: z.string().trim().min(PRODUCT_NAME_LIMITS.minLength).max(PRODUCT_NAME_LIMITS.maxLength),
  quantity: z.number().int().min(ORDER_QUANTITY_LIMITS.min).max(ORDER_QUANTITY_LIMITS.max),
  unitPrice: z.number().int().min(UNIT_PRICE_LIMITS.min).max(UNIT_PRICE_LIMITS.max),
});
const commerceInput = z.object({ service: z.enum(["customer", "business"]) });
// 操作権限を確認し、本人注文の所有・状態遷移・版の競合はユースケースへ渡す。
export const orderRouter = t.router({
  get: procedure
    .use(requireActor(["customer", "business"]))
    .use(requireBusinessIp)
    .use(requirePermissions(["order:read"]))
    .input(commerceInput.extend({ id: z.string().min(1) }))
    .query((props) =>
      props.ctx.container.getOrder.execute(
        parseInputDto(GetOrderInputDto, { actor: props.ctx.actor, id: props.input.id }),
      ),
    ),
  update: procedure
    .use(requireActor(["customer", "business"]))
    .use(requireBusinessIp)
    .use(requirePermissions(["order:update"]))
    .input(commerceInput)
    .input(
      z.object({
        id: z.string().min(1),
        version: z.number().int().nonnegative(),
        lines: z.array(lineSchema).min(ORDER_LINE_LIMITS.minCount).max(ORDER_LINE_LIMITS.maxCount),
      }),
    )
    .mutation((props) =>
      props.ctx.container.manageOrder.execute(
        parseInputDto(ManageOrderInputDto, {
          input: { ...props.input, identity: props.ctx.actor },
        }),
      ),
    ),
  transition: procedure
    .use(requireActor(["customer", "business"]))
    .use(requireBusinessIp)
    .use(requirePermissions(["order:update"]))
    .input(commerceInput)
    .input(
      z.object({
        id: z.string().min(1),
        version: z.number().int().nonnegative(),
        status: z.enum(["confirmed", "cancelled", "shipped", "completed"]),
      }),
    )
    .mutation((props) =>
      props.ctx.container.manageOrder.execute(
        parseInputDto(ManageOrderInputDto, {
          input: { ...props.input, identity: props.ctx.actor },
        }),
      ),
    ),
  list: procedure
    .use(requireActor(["customer", "business"]))
    .use(requireBusinessIp)
    .use(requirePermissions(["order:read"]))
    .input(orderFiltersSchema.safeExtend({ ...commerceInput.shape, ...paginationSchema.shape }))
    .query((props) =>
      props.ctx.container.listOrders
        .execute(
          parseInputDto(ListOrdersInputDto, {
            identity: props.ctx.actor,
            page: { limit: props.input.limit, cursor: props.input.cursor },
            filters: orderFiltersSchema.parse(props.input),
          }),
        )
        .then((result) => result.items),
    ),
  create: procedure
    .use(requireActor(["customer"]))
    .use(requireBusinessIp)
    .use(requirePermissions(["order:create"]))
    .input(commerceInput)
    .input(
      z.object({
        lines: z.array(lineSchema).min(ORDER_LINE_LIMITS.minCount).max(ORDER_LINE_LIMITS.maxCount),
        draft: z.boolean().optional(),
      }),
    )
    .mutation((props) =>
      props.ctx.container.createOrder.execute(
        parseInputDto(CreateOrderInputDto, {
          identity: props.ctx.actor,
          lines: props.input.lines,
          draft: props.input.draft,
        }),
      ),
    ),
});
