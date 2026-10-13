import { z } from "zod";
import { accountCategorySchema } from "#api/application/shared/dto-schemas.ts";

export const accessDirectoryListMembersOutputDtoSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      category: accountCategorySchema,
      name: z.string(),
      email: z.union([z.string(), z.null()]),
      roleId: z.string(),
      roleName: z.string(),
      protectedRole: z.boolean(),
    }),
  ),
});

export const AccessDirectoryListMembersOutputDto = accessDirectoryListMembersOutputDtoSchema
  .brand<"AccessDirectoryListMembersOutputDto">()
  .readonly();

export type AccessDirectoryListMembersOutputDto = z.infer<
  typeof AccessDirectoryListMembersOutputDto
>;
