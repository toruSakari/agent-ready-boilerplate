import { z } from "zod";

export const processOrderEventOutputDtoSchema = z.object({ ok: z.literal(true) });

export const ProcessOrderEventOutputDto = processOrderEventOutputDtoSchema
  .brand<"ProcessOrderEventOutputDto">()
  .readonly();

export type ProcessOrderEventOutputDto = z.infer<typeof ProcessOrderEventOutputDto>;
