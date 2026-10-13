import { OrganizationPlan } from "#admin/features/manage-plans/index.ts";
import { t as translate } from "@dev-template/client/i18n";
import { usePermissions } from "@dev-template/client/entities/access";
import {
  OrganizationSettings,
  BusinessIpSettings,
} from "#admin/features/manage-organizations/index.ts";
import type { AccessOrganization } from "#admin/entities/directory/index.ts";
import { ScopeMembers } from "@dev-template/client/access";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { Card } from "@dev-template/ui/card";
import type { OrganizationDetailSection } from "#admin/widgets/admin-console/model/organization-section.ts";

export function OrganizationDetailContent(props: {
  organization: AccessOrganization;
  section: OrganizationDetailSection;
}) {
  const { can } = usePermissions("platform");
  const organizationId = props.organization.id;
  return (
    <>
      {props.section === "overview" &&
        (can("organization.manage") ? (
          <OrganizationSettings organization={props.organization} />
        ) : (
          <Card className="p-6">
            {translate("所属人数：{{count}}", { count: props.organization.memberCount })}
          </Card>
        ))}
      {props.section === "overview" && can("plan.manage") && (
        <DataErrorBoundary>
          <OrganizationPlan id={organizationId} name={props.organization.name} />
        </DataErrorBoundary>
      )}
      {(props.section === "members" || props.section === "roles" || props.section === "audit") && (
        <DataErrorBoundary loadingLabel={translate("メンバー・権限を読み込み中…")}>
          <ScopeMembers scope={organizationId} platform section={props.section} />
        </DataErrorBoundary>
      )}
      {props.section === "ip" &&
        (can("organization.manage") ? (
          <Card className="p-6">
            <BusinessIpSettings id={organizationId} />
          </Card>
        ) : (
          <Card className="p-6">{translate("IP制限を管理する権限がありません。")}</Card>
        ))}
    </>
  );
}
