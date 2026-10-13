import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const manageStockChangeInputDtoSchema = z.object({
  actor: authorizedActorSchema,
  input: z.object({ id: z.string(), quantity: z.number(), expectedStock: z.number() }),
});

export const ManageStockChangeInputDto = manageStockChangeInputDtoSchema
  .brand<"ManageStockChangeInputDto">()
  .readonly();

export type ManageStockChangeInputDto = z.infer<typeof ManageStockChangeInputDto>;
