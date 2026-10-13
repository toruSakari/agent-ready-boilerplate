import type { OrganizationDetailSection } from "#admin/widgets/admin-console/model/organization-section.ts";
import { OrganizationDetailNavigation } from "#admin/widgets/admin-console/ui/organization-detail-navigation.tsx";
import { OrganizationDetailContent } from "#admin/widgets/admin-console/ui/organization-detail-content.tsx";
import { t as translate } from "@dev-template/client/i18n";
import { Link } from "@tanstack/react-router";
import { useOrganizations } from "#admin/entities/directory/index.ts";
import { Button } from "@dev-template/ui/button";
import { Card } from "@dev-template/ui/card";

export function AdminOrganizationDetail(props: {
  organizationId: string;
  section?: OrganizationDetailSection;
}) {
  const { organizationId, section = "overview" } = props;

  const organizations = useOrganizations();
  const organization = organizations.data?.find((o) => o.id === organizationId);
  return (
    <div className="grid gap-6">
      <Button variant="ghost" className="w-fit" asChild>
        <Link to="/organizations">{translate("企業一覧に戻る")}</Link>
      </Button>
      <header>
        <p className="text-sm text-muted-foreground">{translate("企業管理")}</p>
        <h1 className="mt-2 text-3xl font-bold">{organization?.name ?? translate("企業詳細")}</h1>
      </header>
      {organization ? (
        <>
          <OrganizationDetailNavigation organizationId={organizationId} section={section} />
          <OrganizationDetailContent organization={organization} section={section} />
        </>
      ) : (
        <Card className="p-8">
          {organizations.data === null
            ? translate("企業一覧を閲覧する権限がありません。")
            : translate("企業が見つかりません。")}
        </Card>
      )}
    </div>
  );
}
