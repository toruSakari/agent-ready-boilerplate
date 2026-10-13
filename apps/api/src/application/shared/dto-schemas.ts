import { identitySchema } from "#api/application/auth/contracts/identity.ts";
import { z } from "zod";
import {
  permissionCodeSchema,
  PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import { accountCategorySchema } from "#api/domain/access/policies/account-categories.ts";
import { ORDER_STATUS_CODES } from "#api/domain/order/policies/order-status.ts";
import { paginationSchema } from "#api/application/shared/pagination.ts";
import { authorizedActorSchema } from "#api/application/auth/schemas/authorized-actor-schema.ts";

export { authorizedActorSchema };
export { permissionCodeSchema };
export { accountCategorySchema };
export const planCategorySchema = accountCategorySchema.exclude(["operator"]);
export const orderStatusSchema = z.enum(ORDER_STATUS_CODES);
export const identityChannelSchema = identitySchema.unwrap().shape.channel;
export const pageCursorSchema = paginationSchema.shape.cursor.unwrap();
export const pageRequestSchema = paginationSchema.extend({
  limit: paginationSchema.shape.limit.removeDefault(),
});
export const permissionLabelSchema = z.enum(Object.values(PERMISSIONS));
export const permissionCatalogSchema = z
  .record(permissionCodeSchema, permissionLabelSchema)
  .readonly();
export const arrayBufferSchema = z.instanceof(ArrayBuffer);
