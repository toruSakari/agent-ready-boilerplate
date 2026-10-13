import { t as translate } from "#client/shared/i18n";
import type { Permission } from "#client/entities/access/model/types";

// APIは付与可能なコードを決め、クライアントはその表示名だけを翻訳する。
const permissionLabels = {
  "organization.read": () => translate("企業一覧の閲覧"),
  "organization.manage": () => translate("企業の作成・変更・停止"),
  "user.read": () => translate("全ユーザーの基本情報閲覧"),
  "user.personal.read": () => translate("個人情報の閲覧"),
  "user.delete": () => translate("アカウント削除"),
  "plan.manage": () => translate("プランの割当管理"),
  "member.read": () => translate("メンバー閲覧"),
  "member.invite": () => translate("メンバー招待"),
  "member.assign_role": () => translate("メンバーのロール変更"),
  "member.remove": () => translate("所属解除"),
  "role.manage": () => translate("カスタムロール管理"),
  "audit.read": () => translate("監査ログ閲覧"),
  "order:read": () => translate("注文閲覧"),
  "order:create": () => translate("注文作成"),
  "order:update": () => translate("注文変更"),
  "product.read": () => translate("商品閲覧"),
  "product.update": () => translate("商品管理"),
} satisfies Record<Permission, () => string>;

/** 将来の未知コードも編集画面から消さず、APIの日本語ラベルには依存しない。 */
export function permissionLabel(code: string): string {
  return Object.hasOwn(permissionLabels, code) ? permissionLabels[code as Permission]() : code;
}
