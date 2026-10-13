import { z } from "zod";
import { ManageOrderInput } from "#api/application/order/dtos/manage-order-input.ts";

export const manageOrderInputDtoSchema = z.object({ input: ManageOrderInput });

export const ManageOrderInputDto = manageOrderInputDtoSchema
  .brand<"ManageOrderInputDto">()
  .readonly();

export type ManageOrderInputDto = z.infer<typeof ManageOrderInputDto>;
