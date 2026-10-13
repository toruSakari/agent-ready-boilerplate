import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const manageStockGetInputDtoSchema = z.object({
  actor: authorizedActorSchema,
  id: z.string(),
});

export const ManageStockGetInputDto = manageStockGetInputDtoSchema
  .brand<"ManageStockGetInputDto">()
  .readonly();

export type ManageStockGetInputDto = z.infer<typeof ManageStockGetInputDto>;
