import type { Permission } from "@dev-template/client/entities/access";

/** 同じ企業内で利用できる作業。権限条件とラベルを一つの定義から描画する。 */
export const businessNavigationItems = [
  { to: "/organizations/$organizationId", label: "ダッシュボード" },
  { to: "/organizations/$organizationId/orders", label: "注文", permission: "order:read" },
  { to: "/organizations/$organizationId/inventory", label: "在庫", permission: "product.read" },
  { to: "/organizations/$organizationId/products", label: "商品", permission: "product.read" },
  {
    to: "/organizations/$organizationId/members",
    label: "メンバー・権限",
    permission: "member.read",
  },
  { to: "/organizations/$organizationId/roles", label: "ロール・権限", permission: "role.manage" },
  { to: "/organizations/$organizationId/audit", label: "監査履歴", permission: "audit.read" },
  { to: "/organizations/$organizationId/settings", label: "設定" },
] satisfies { to: string; label: string; permission?: Permission }[];
