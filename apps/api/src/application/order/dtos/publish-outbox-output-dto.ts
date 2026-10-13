import { z } from "zod";

export const publishOutboxOutputDtoSchema = z.object({ publishedCount: z.number() });

export const PublishOutboxOutputDto = publishOutboxOutputDtoSchema
  .brand<"PublishOutboxOutputDto">()
  .readonly();

export type PublishOutboxOutputDto = z.infer<typeof PublishOutboxOutputDto>;
