import { z } from "zod";

export const publishOutboxInputDtoSchema = z.object({ limit: z.number().optional() });

export const PublishOutboxInputDto = publishOutboxInputDtoSchema
  .brand<"PublishOutboxInputDto">()
  .readonly();

export type PublishOutboxInputDto = z.infer<typeof PublishOutboxInputDto>;
