import { z } from "zod";
import { accountCategorySchema } from "#api/application/shared/dto-schemas.ts";

export const accessDirectoryListUsersOutputDtoSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      category: accountCategorySchema,
      name: z.string(),
      email: z.union([z.string(), z.null()]),
      memberships: z.array(
        z.object({
          id: z.string(),
          scope: z.string(),
          organizationName: z.string(),
          roleName: z.string(),
          roleId: z.string(),
        }),
      ),
    }),
  ),
});

export const AccessDirectoryListUsersOutputDto = accessDirectoryListUsersOutputDtoSchema
  .brand<"AccessDirectoryListUsersOutputDto">()
  .readonly();

export type AccessDirectoryListUsersOutputDto = z.infer<typeof AccessDirectoryListUsersOutputDto>;
