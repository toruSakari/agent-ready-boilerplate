import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";
import { organizationFiltersSchema } from "#api/domain/shared/list-filters.ts";

export const listOrganizationDirectoryInputDtoSchema = z.object({
  actor: authorizedActorSchema,
  filters: organizationFiltersSchema,
  page: z.object({ limit: z.number(), afterId: z.union([z.string(), z.undefined()]).optional() }),
});

export const ListOrganizationDirectoryInputDto = listOrganizationDirectoryInputDtoSchema
  .brand<"ListOrganizationDirectoryInputDto">()
  .readonly();

export type ListOrganizationDirectoryInputDto = z.infer<typeof ListOrganizationDirectoryInputDto>;
