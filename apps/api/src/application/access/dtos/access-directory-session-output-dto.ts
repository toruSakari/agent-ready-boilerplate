import { z } from "zod";
import {
  identityChannelSchema,
  permissionCodeSchema,
} from "#api/application/shared/dto-schemas.ts";

export const accessDirectorySessionOutputDtoSchema = z.object({
  userId: z.string(),
  channel: identityChannelSchema,
  organizations: z.array(z.object({ id: z.string(), name: z.string(), roleName: z.string() })),
  platformPermissions: z.array(permissionCodeSchema).readonly(),
  permissions: z.array(permissionCodeSchema),
  permissionCatalog: z.object({
    "organization.read": z.literal("企業一覧の閲覧"),
    "organization.manage": z.literal("企業の作成・変更・停止"),
    "user.read": z.literal("全ユーザーの基本情報閲覧"),
    "user.personal.read": z.literal("個人情報の閲覧"),
    "user.delete": z.literal("アカウント削除"),
    "plan.manage": z.literal("プランの割当管理"),
    "member.read": z.literal("メンバー閲覧"),
    "member.invite": z.literal("メンバー招待"),
    "member.assign_role": z.literal("メンバーのロール変更"),
    "member.remove": z.literal("所属解除"),
    "role.manage": z.literal("カスタムロール管理"),
    "audit.read": z.literal("監査ログ閲覧"),
    "order:read": z.literal("注文閲覧"),
    "order:create": z.literal("注文作成"),
    "order:update": z.literal("注文変更"),
    "product.read": z.literal("商品閲覧"),
    "product.update": z.literal("商品管理"),
  }),
});

export const AccessDirectorySessionOutputDto = accessDirectorySessionOutputDtoSchema
  .brand<"AccessDirectorySessionOutputDto">()
  .readonly();

export type AccessDirectorySessionOutputDto = z.infer<typeof AccessDirectorySessionOutputDto>;
