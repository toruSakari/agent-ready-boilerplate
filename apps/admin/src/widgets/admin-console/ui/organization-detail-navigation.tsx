import { t as translate } from "@dev-template/client/i18n";
import { Link } from "@tanstack/react-router";
import { Button } from "@dev-template/ui/button";
import type { OrganizationDetailSection } from "#admin/widgets/admin-console/model/organization-section.ts";

const navigationItems = [
  { section: "overview", label: "基本設定", to: "/organizations/$organizationId" },
  {
    section: "members",
    label: "メンバー",
    to: "/organizations/$organizationId/members",
  },
  {
    section: "roles",
    label: "ロール・権限",
    to: "/organizations/$organizationId/roles",
  },
  { section: "audit", label: "監査ログ", to: "/organizations/$organizationId/audit" },
  {
    section: "ip",
    label: "IP制限",
    to: "/organizations/$organizationId/ip-settings",
  },
] as const;

export function OrganizationDetailNavigation(props: {
  organizationId: string;
  section: OrganizationDetailSection;
}) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label={translate("企業設定ナビゲーション")}>
      {navigationItems.map((item) => (
        <Button
          key={item.section}
          variant={item.section === props.section ? "default" : "outline"}
          asChild
        >
          <Link to={item.to} params={{ organizationId: props.organizationId }}>
            {translate(item.label)}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
