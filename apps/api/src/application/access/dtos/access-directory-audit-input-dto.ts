import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessDirectoryAuditInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  scope: z.string(),
});

export const AccessDirectoryAuditInputDto = accessDirectoryAuditInputDtoSchema
  .brand<"AccessDirectoryAuditInputDto">()
  .readonly();

export type AccessDirectoryAuditInputDto = z.infer<typeof AccessDirectoryAuditInputDto>;
