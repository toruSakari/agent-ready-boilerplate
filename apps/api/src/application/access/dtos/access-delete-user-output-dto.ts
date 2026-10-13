import { z } from "zod";

export const accessDeleteUserOutputDtoSchema = z.object({ ok: z.literal(true) });

export const AccessDeleteUserOutputDto = accessDeleteUserOutputDtoSchema
  .brand<"AccessDeleteUserOutputDto">()
  .readonly();

export type AccessDeleteUserOutputDto = z.infer<typeof AccessDeleteUserOutputDto>;
