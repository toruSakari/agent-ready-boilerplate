import { parseInputDto } from "#api/application/shared/parse-input-dto.ts";
import { ProductAddImageInputDto } from "#api/application/product/dtos/product-add-image-input-dto.ts";
import { ProductGetInputDto } from "#api/application/product/dtos/product-get-input-dto.ts";
import { ProductUpdateInputDto } from "#api/application/product/dtos/product-update-input-dto.ts";
import { ProductGetImageInputDto } from "#api/application/product/dtos/product-get-image-input-dto.ts";
import { ProductUploadImageInputDto } from "#api/application/product/dtos/product-upload-image-input-dto.ts";
import { ProductDeleteImageInputDto } from "#api/application/product/dtos/product-delete-image-input-dto.ts";
import { ProductListInputDto } from "#api/application/product/dtos/product-list-input-dto.ts";
import { CreateProductInputDto } from "#api/application/product/dtos/create-product-input-dto.ts";
import { DEFAULT_INITIAL_STOCK } from "#api/application/product/dtos/create-product-input.ts";
import { STOCK_QUANTITY_LIMITS } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { listFiltersSchema } from "#api/domain/shared/list-filters.ts";
import { paginationSchema } from "#api/application/shared/pagination.ts";
import { requireBusinessIp } from "#api/presentation/shared/middleware/business-ip-restriction.ts";
import { SKU_LIMITS } from "#api/domain/shared/value-objects/sku.ts";
import { PRODUCT_NAME_LIMITS } from "#api/domain/shared/value-objects/product-name.ts";
import { UNIT_PRICE_LIMITS } from "#api/domain/shared/value-objects/unit-price.ts";
import { z } from "zod";
import { t, procedure } from "#api/presentation/shared/trpc-core.ts";
import {
  requireActor,
  requirePermissions,
} from "#api/presentation/shared/middleware/trpc-authorization.ts";
import { imageUploadInput, readImageFile } from "#api/presentation/product/image-input.ts";
import { imageOutput } from "#api/presentation/product/image-output.ts";

const commerceInput = z.object({ service: z.enum(["customer", "business"]) });
export const productRouter = t.router({
  get: procedure
    .use(requireActor(["customer", "business"]))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.read"]))
    .input(commerceInput.extend({ id: z.string().min(1) }))
    .query((props) =>
      props.ctx.container.products.get(
        parseInputDto(ProductGetInputDto, { identity: props.ctx.actor, id: props.input.id }),
      ),
    ),
  update: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.read", "product.update"]))
    .input(
      z.object({
        id: z.string().min(1),
        name: z
          .string()
          .trim()
          .min(PRODUCT_NAME_LIMITS.minLength)
          .max(PRODUCT_NAME_LIMITS.maxLength),
        unitPrice: z.number().int().min(UNIT_PRICE_LIMITS.min).max(UNIT_PRICE_LIMITS.max),
        expectedName: z
          .string()
          .min(PRODUCT_NAME_LIMITS.minLength)
          .max(PRODUCT_NAME_LIMITS.maxLength),
        expectedUnitPrice: z.number().int().min(UNIT_PRICE_LIMITS.min).max(UNIT_PRICE_LIMITS.max),
      }),
    )
    .mutation((props) =>
      props.ctx.container.products.update(
        parseInputDto(ProductUpdateInputDto, { identity: props.ctx.actor, input: props.input }),
      ),
    ),
  getImage: procedure
    .meta({ standalone: true })
    .use(requireActor(["customer", "business"]))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.read"]))
    .input(commerceInput.extend({ id: z.string().min(1), imageId: z.string().min(1).optional() }))
    .query(async (props) =>
      imageOutput(
        await props.ctx.container.products.getImage(
          parseInputDto(ProductGetImageInputDto, {
            identity: props.ctx.actor,
            id: props.input.id,
            imageId: props.input.imageId,
          }),
        ),
        props.ctx.request.signal,
      ),
    ),
  replaceImage: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.read", "product.update"]))
    .input(imageUploadInput)
    .mutation(async (props) => {
      const { bytes, contentType } = await readImageFile(props.input.file);
      await props.ctx.container.products.uploadImage(
        parseInputDto(ProductUploadImageInputDto, {
          identity: props.ctx.actor,
          id: props.input.id,
          bytes,
          contentType,
        }),
      );
      return { ok: true };
    }),
  addImage: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.read", "product.update"]))
    .input(imageUploadInput)
    .mutation(async (props) => {
      const { bytes, contentType } = await readImageFile(props.input.file);
      await props.ctx.container.products.addImage(
        parseInputDto(ProductAddImageInputDto, {
          identity: props.ctx.actor,
          id: props.input.id,
          bytes,
          contentType,
        }),
      );
      return { ok: true };
    }),
  deleteImage: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.read", "product.update"]))
    .input(z.object({ id: z.string().min(1), imageId: z.string().min(1).optional() }))
    .mutation(async (props) => {
      await props.ctx.container.products
        .deleteImage(
          parseInputDto(ProductDeleteImageInputDto, {
            identity: props.ctx.actor,
            id: props.input.id,
            imageId: props.input.imageId,
          }),
        )
        .then(() => undefined);
      return { ok: true };
    }),
  list: procedure
    .use(requireActor(["customer", "business"]))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.read"]))
    .input(commerceInput.merge(paginationSchema).merge(listFiltersSchema))
    .query((props) =>
      props.ctx.container.products
        .list(
          parseInputDto(ProductListInputDto, {
            identity: props.ctx.actor,
            page: { limit: props.input.limit, cursor: props.input.cursor },
            filters: listFiltersSchema.parse(props.input),
          }),
        )
        .then((result) => result.items),
    ),
  create: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(requirePermissions(["product.update"]))
    .input(
      z.object({
        sku: z.string().trim().min(SKU_LIMITS.minLength).max(SKU_LIMITS.maxLength),
        name: z
          .string()
          .trim()
          .min(PRODUCT_NAME_LIMITS.minLength)
          .max(PRODUCT_NAME_LIMITS.maxLength),
        unitPrice: z.number().int().min(UNIT_PRICE_LIMITS.min).max(UNIT_PRICE_LIMITS.max),
        initialStock: z
          .number()
          .int()
          .min(STOCK_QUANTITY_LIMITS.min)
          .max(STOCK_QUANTITY_LIMITS.max)
          .default(DEFAULT_INITIAL_STOCK),
      }),
    )
    .mutation((props) =>
      props.ctx.container.createProduct.execute(
        parseInputDto(CreateProductInputDto, { actor: props.ctx.actor, input: props.input }),
      ),
    ),
});
