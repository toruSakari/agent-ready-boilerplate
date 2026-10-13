import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessRegisterCustomerInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({ name: z.string() }),
});

export const AccessRegisterCustomerInputDto = accessRegisterCustomerInputDtoSchema
  .brand<"AccessRegisterCustomerInputDto">()
  .readonly();

export type AccessRegisterCustomerInputDto = z.infer<typeof AccessRegisterCustomerInputDto>;
