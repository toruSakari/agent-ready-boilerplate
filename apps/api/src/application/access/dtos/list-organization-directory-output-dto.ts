import { z } from "zod";
import { OrganizationDirectoryItemDto } from "#api/application/access/dtos/organization-directory-output.ts";

export const listOrganizationDirectoryOutputDtoSchema = z.object({
  items: z.array(OrganizationDirectoryItemDto),
  nextId: z.union([z.string(), z.null()]),
});

export const ListOrganizationDirectoryOutputDto = listOrganizationDirectoryOutputDtoSchema
  .brand<"ListOrganizationDirectoryOutputDto">()
  .readonly();

export type ListOrganizationDirectoryOutputDto = z.infer<typeof ListOrganizationDirectoryOutputDto>;
