import type { z } from "zod";
import { orderSnapshotSchema } from "#api/application/order/dtos/order-value-schemas.ts";

export const manageOrderOutputDtoSchema = orderSnapshotSchema;

export const ManageOrderOutputDto = manageOrderOutputDtoSchema
  .brand<"ManageOrderOutputDto">()
  .readonly();

export type ManageOrderOutputDto = z.infer<typeof ManageOrderOutputDto>;
