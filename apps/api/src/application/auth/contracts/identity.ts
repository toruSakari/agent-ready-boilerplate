import { z } from "zod";
import { permissionCodeSchema } from "#api/domain/access/policies/permission-catalog.ts";

export const identitySchema = z
  .object({
    /** DB解決後は対象サービスの会員ID。認証プロバイダーのsubjectとは区別する。 */
    userId: z.string(),
    /** 認証プロバイダーが検証した本人ID。この値だけではサービス登録を意味しない。 */
    subjectId: z.string().optional(),
    tenantId: z.string(),
    role: z.enum(["admin", "member"]),
    email: z.string().optional(),
    channel: z.enum(["admin", "business", "customer"]).optional(),
    /** 解決時点の情報。業務実行前にはプロバイダーが現在権限を再確認する。 */
    permissions: z.array(permissionCodeSchema).readonly(),
  })
  .readonly();

export type Identity = z.infer<typeof identitySchema>;
