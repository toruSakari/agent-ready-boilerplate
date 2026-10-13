import { t as translate } from "@dev-template/client/i18n";
import { Link } from "@tanstack/react-router";
import { useOrganizationId } from "@dev-template/client/api";
import { usePermissions } from "@dev-template/client/entities/access";
import { Button } from "@dev-template/ui/button";
import { businessNavigationItems } from "#business/widgets/business-navigation/model/navigation-items.ts";

export function BusinessNavigation(props: { variant?: "console" | "dashboard" }) {
  const { variant: _variant = "console" } = props;

  const organizationId = useOrganizationId();
  const { can } = usePermissions();
  if (!organizationId) {
    return null;
  }

  return (
    <nav aria-label={translate("企業ナビゲーション")} className="flex flex-wrap gap-1 lg:flex-col">
      {businessNavigationItems
        .filter((item) => !item.permission || can(item.permission))
        .map((item) => (
          <Button key={item.to} asChild variant="ghost" className="justify-start">
            <Link
              to={item.to}
              params={{ organizationId }}
              activeOptions={{ exact: item.to === "/organizations/$organizationId" }}
              activeProps={{ className: "bg-accent text-accent-foreground" }}
            >
              {translate(item.label)}
            </Link>
          </Button>
        ))}
    </nav>
  );
}
