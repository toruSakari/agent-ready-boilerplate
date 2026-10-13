import { parseInputDto } from "#api/application/shared/parse-input-dto.ts";
import { StoreListInputDto } from "#api/application/store/dtos/store-list-input-dto.ts";
import { StoreGetInputDto } from "#api/application/store/dtos/store-get-input-dto.ts";
import { StoreGetImageInputDto } from "#api/application/store/dtos/store-get-image-input-dto.ts";
import { StoreCheckoutInputDto } from "#api/application/store/dtos/store-checkout-input-dto.ts";
import { StoreListOrdersInputDto } from "#api/application/store/dtos/store-list-orders-input-dto.ts";
import { StoreCancelOrderInputDto } from "#api/application/store/dtos/store-cancel-order-input-dto.ts";
import { StoreGetOrderInputDto } from "#api/application/store/dtos/store-get-order-input-dto.ts";
import { orderFiltersSchema, storeFiltersSchema } from "#api/domain/shared/list-filters.ts";
import { z } from "zod";
import { t, procedure } from "#api/presentation/shared/trpc-core.ts";
import { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";
import { paginationSchema } from "#api/application/shared/pagination.ts";
import { SKU_LIMITS } from "#api/domain/shared/value-objects/sku.ts";
import { PRODUCT_NAME_LIMITS } from "#api/domain/shared/value-objects/product-name.ts";
import { UNIT_PRICE_LIMITS } from "#api/domain/shared/value-objects/unit-price.ts";
import { ORDER_QUANTITY_LIMITS } from "#api/domain/order/value-objects/order-quantity.ts";
import { ORDER_LINE_LIMITS } from "#api/domain/order/entities/order.ts";
import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { imageOutput } from "#api/presentation/product/image-output.ts";

const productInput = z.object({
  tenantId: z
    .string()
    .min(1)
    .max(ACCESS_LIMITS.idMaxLength)
    .refine((value) => value === value.trim() && !/\p{Cc}/u.test(value)),
  sku: z.string().min(SKU_LIMITS.minLength).max(SKU_LIMITS.maxLength),
});
const requireCustomer = t.middleware(async (props) => {
  const identity = await props.ctx.resolveCustomer();
  const actor = await prepareAuthorizedActor(props.ctx.container.identityProvider, identity, []);
  return props.next({ ctx: { actor } });
});
/** 公開ストアと本人購入の境界。企業の所属・操作権限を公開ストアへ流用しない。 */
export const storeRouter = t.router({
  list: procedure
    .meta({ public: true })
    .input(storeFiltersSchema.safeExtend(paginationSchema.shape))
    .query((props) =>
      props.ctx.container.store.list(
        parseInputDto(StoreListInputDto, {
          page: props.input,
          search: props.input.search,
          filters: props.input,
        }),
      ),
    ),
  get: procedure
    .meta({ public: true })
    .input(productInput)
    .query((props) =>
      props.ctx.container.store.get(
        parseInputDto(StoreGetInputDto, { tenantId: props.input.tenantId, sku: props.input.sku }),
      ),
    ),
  getImage: procedure
    .meta({ public: true, standalone: true })
    .input(productInput.extend({ imageId: z.string().min(1).optional() }))
    .query(async (props) =>
      imageOutput(
        await props.ctx.container.store.getImage(
          parseInputDto(StoreGetImageInputDto, {
            tenantId: props.input.tenantId,
            sku: props.input.sku,
            imageId: props.input.imageId,
          }),
        ),
        props.ctx.request.signal,
      ),
    ),
  checkout: procedure
    .use(requireCustomer)
    .input(
      productInput.pick({ tenantId: true }).extend({
        lines: z
          .array(
            z.object({
              sku: z.string().min(SKU_LIMITS.minLength).max(SKU_LIMITS.maxLength),
              name: z
                .string()
                .min(PRODUCT_NAME_LIMITS.minLength)
                .max(PRODUCT_NAME_LIMITS.maxLength),
              quantity: z
                .number()
                .int()
                .min(ORDER_QUANTITY_LIMITS.min)
                .max(ORDER_QUANTITY_LIMITS.max),
              unitPrice: z.number().int().min(UNIT_PRICE_LIMITS.min).max(UNIT_PRICE_LIMITS.max),
            }),
          )
          .min(ORDER_LINE_LIMITS.minCount)
          .max(ORDER_LINE_LIMITS.maxCount),
      }),
    )
    .mutation((props) =>
      props.ctx.container.store.checkout(
        parseInputDto(StoreCheckoutInputDto, {
          identity: props.ctx.actor,
          tenantId: props.input.tenantId,
          lines: props.input.lines,
        }),
      ),
    ),
  listOrders: procedure
    .use(requireCustomer)
    .input(orderFiltersSchema.safeExtend(paginationSchema.shape))
    .query((props) =>
      props.ctx.container.store.listOrders(
        parseInputDto(StoreListOrdersInputDto, {
          identity: props.ctx.actor,
          page: props.input,
          filters: props.input,
        }),
      ),
    ),
  cancelOrder: procedure
    .use(requireCustomer)
    .input(z.object({ id: z.string().min(1), version: z.number().int().nonnegative() }).strict())
    .mutation((props) =>
      props.ctx.container.store.cancelOrder(
        parseInputDto(StoreCancelOrderInputDto, {
          identity: props.ctx.actor,
          id: props.input.id,
          version: props.input.version,
        }),
      ),
    ),
  getOrder: procedure
    .use(requireCustomer)
    .input(z.object({ id: z.string().min(1) }))
    .query((props) =>
      props.ctx.container.store.getOrder(
        parseInputDto(StoreGetOrderInputDto, { identity: props.ctx.actor, id: props.input.id }),
      ),
    ),
});
