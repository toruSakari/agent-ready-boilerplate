import { z } from "zod";
import { accountCategorySchema } from "#api/domain/access/policies/account-categories.ts";

/** 操作するサービス会員と用途の選択。選択値自体は会員資格や権限の証明にならない。 */
export const serviceActorSchema = z
  .object({
    service: accountCategorySchema,
    purpose: z.enum(["registration", "invitation", "withdrawal"]).optional(),
  })
  .readonly();

export type ServiceActor = z.infer<typeof serviceActorSchema>;
