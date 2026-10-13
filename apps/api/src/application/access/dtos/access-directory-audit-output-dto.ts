import { z } from "zod";

export const accessDirectoryAuditOutputDtoSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      actorId: z.string(),
      scope: z.string(),
      action: z.string(),
      targetId: z.string(),
      occurredAt: z.string(),
    }),
  ),
});

export const AccessDirectoryAuditOutputDto = accessDirectoryAuditOutputDtoSchema
  .brand<"AccessDirectoryAuditOutputDto">()
  .readonly();

export type AccessDirectoryAuditOutputDto = z.infer<typeof AccessDirectoryAuditOutputDto>;
