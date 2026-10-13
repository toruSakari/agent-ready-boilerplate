import { z } from "zod";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";

// コード・表示名・サービス上限を同じ行で定義し、追加時の一覧更新漏れを防ぐ。
const definitions = [
  { code: "organization.read", label: "企業一覧の閲覧", services: ["operator"] },
  { code: "organization.manage", label: "企業の作成・変更・停止", services: ["operator"] },
  { code: "user.read", label: "全ユーザーの基本情報閲覧", services: ["operator"] },
  { code: "user.personal.read", label: "個人情報の閲覧", services: ["operator"] },
  { code: "user.delete", label: "アカウント削除", services: ["operator"] },
  { code: "plan.manage", label: "プランの割当管理", services: ["operator"] },
  { code: "member.read", label: "メンバー閲覧", services: ["operator", "business"] },
  { code: "member.invite", label: "メンバー招待", services: ["operator", "business"] },
  { code: "member.assign_role", label: "メンバーのロール変更", services: ["operator", "business"] },
  { code: "member.remove", label: "所属解除", services: ["operator", "business"] },
  { code: "role.manage", label: "カスタムロール管理", services: ["operator", "business"] },
  { code: "audit.read", label: "監査ログ閲覧", services: ["operator", "business"] },
  { code: "order:read", label: "注文閲覧", services: ["business", "customer"] },
  { code: "order:create", label: "注文作成", services: ["customer"] },
  { code: "order:update", label: "注文変更", services: ["business", "customer"] },
  { code: "product.read", label: "商品閲覧", services: ["business", "customer"] },
  { code: "product.update", label: "商品管理", services: ["business"] },
] as const satisfies readonly {
  code: string;
  label: string;
  services: readonly AccountCategoryCode[];
}[];

type Definition = (typeof definitions)[number];

export type PermissionCode = Definition["code"];

type PermissionLabels = {
  readonly [Code in PermissionCode]: Extract<
    Definition,
    {
      code: Code;
    }
  >["label"];
};

export const PERMISSION_CODES = Object.freeze(definitions.map((props) => props.code));
export const permissionCodeSchema = z.enum(PERMISSION_CODES);
// 全定義から同じコードのラベルを取り出すため、元のキーとラベルの型を保って公開する。
// この型付けは表の変換だけに使い、値オブジェクトのブランドはcreateで検証して付ける。
export const PERMISSIONS = Object.freeze(
  Object.fromEntries(definitions.map((props) => [props.code, props.label])),
) as PermissionLabels;

function permissionsFor(service: AccountCategoryCode): readonly PermissionCode[] {
  return Object.freeze(
    definitions
      .filter((props) => props.services.some((category) => category === service))
      .map((props) => props.code),
  );
}

// 実行時には保存済みロールと対象サービスのプランも重ねて絞る。
export const PLATFORM_PERMISSIONS = permissionsFor("operator");
export const BUSINESS_PERMISSIONS = permissionsFor("business");
export const CUSTOMER_PERMISSIONS = permissionsFor("customer");
