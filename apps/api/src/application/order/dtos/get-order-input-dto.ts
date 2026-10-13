import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const getOrderInputDtoSchema = z.object({ actor: authorizedActorSchema, id: z.string() });

export const GetOrderInputDto = getOrderInputDtoSchema.brand<"GetOrderInputDto">().readonly();

export type GetOrderInputDto = z.infer<typeof GetOrderInputDto>;
