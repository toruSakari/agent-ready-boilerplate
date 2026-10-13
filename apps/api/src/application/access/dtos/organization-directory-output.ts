import { z } from "zod";

export const organizationDirectoryItemDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  invitationsEnabled: z.boolean(),
  memberCount: z.number(),
  planCode: z.union([z.string(), z.null()]),
});
export const OrganizationDirectoryItemDto = organizationDirectoryItemDtoSchema
  .brand<"OrganizationDirectoryItemDto">()
  .readonly();

export type OrganizationDirectoryItemDto = z.infer<typeof OrganizationDirectoryItemDto>;
