import { parseInputDto } from "#api/application/shared/parse-input-dto.ts";
import { ManageStockAdjustInputDto } from "#api/application/inventory/dtos/manage-stock-adjust-input-dto.ts";
import { ManageStockGetInputDto } from "#api/application/inventory/dtos/manage-stock-get-input-dto.ts";
import { ManageStockChangeInputDto } from "#api/application/inventory/dtos/manage-stock-change-input-dto.ts";
import { InventoryOverviewListInputDto } from "#api/application/inventory/dtos/inventory-overview-list-input-dto.ts";
import { InventoryOverviewHistoryInputDto } from "#api/application/inventory/dtos/inventory-overview-history-input-dto.ts";
import { inventoryFiltersSchema } from "#api/domain/shared/list-filters.ts";
import { z } from "zod";
import { STOCK_QUANTITY_LIMITS } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { t, procedure } from "#api/presentation/shared/trpc-core.ts";
import {
  requireActor,
  requirePermissions,
} from "#api/presentation/shared/middleware/trpc-authorization.ts";
import { requireBusinessIp } from "#api/presentation/shared/middleware/business-ip-restriction.ts";
import { stockAdjustmentSchema } from "#api/domain/inventory/policies/stock-adjustment.ts";
import { paginationSchema, PAGE_LIMITS } from "#api/application/shared/pagination.ts";

const stock = z.number().int().min(STOCK_QUANTITY_LIMITS.min).max(STOCK_QUANTITY_LIMITS.max);
export const inventoryRouter = t.router({
  list: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.read"]))
    .input(
      paginationSchema
        .merge(inventoryFiltersSchema)
        .extend({
          limit: z
            .number()
            .int()
            .min(1)
            .max(PAGE_LIMITS.defaultSize)
            .default(PAGE_LIMITS.defaultSize),
        })
        .optional(),
    )
    .query((props) =>
      props.ctx.container.inventoryOverview
        .list(
          parseInputDto(InventoryOverviewListInputDto, {
            actor: props.ctx.actor,
            request: props.input && { limit: props.input.limit, cursor: props.input.cursor },
            filters: props.input,
          }),
        )
        .then((result) => result.items),
    ),
  history: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.read"]))
    .input(paginationSchema.extend({ id: z.string().min(1) }))
    .query((props) =>
      props.ctx.container.inventoryOverview
        .history(
          parseInputDto(InventoryOverviewHistoryInputDto, {
            actor: props.ctx.actor,
            id: props.input.id,
            request: {
              limit: props.input.limit,
              cursor: props.input.cursor,
            },
          }),
        )
        .then((result) => result.items),
    ),
  adjust: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.read", "product.update"]))
    .input(
      z
        .object({ id: z.string().min(1), operationId: z.uuid(), adjustment: stockAdjustmentSchema })
        .strict(),
    )
    .mutation((props) =>
      props.ctx.container.manageStock.adjust(
        parseInputDto(ManageStockAdjustInputDto, { actor: props.ctx.actor, input: props.input }),
      ),
    ),
  get: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.read"]))
    .input(z.object({ id: z.string().min(1) }).strict())
    .query((props) =>
      props.ctx.container.manageStock.get(
        parseInputDto(ManageStockGetInputDto, { actor: props.ctx.actor, id: props.input.id }),
      ),
    ),
  change: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.read", "product.update"]))
    .input(z.object({ id: z.string().min(1), quantity: stock, expectedStock: stock }).strict())
    .mutation((props) =>
      props.ctx.container.manageStock.change(
        parseInputDto(ManageStockChangeInputDto, { actor: props.ctx.actor, input: props.input }),
      ),
    ),
});
