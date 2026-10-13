import { t as translate } from "@dev-template/client/i18n";
import { useNavigate } from "@tanstack/react-router";
import { usePermissions } from "@dev-template/client/entities/access";
import { ActionForm, ACCESS_FORM_LIMITS } from "@dev-template/client/manage-access";
import { useOrganizationMutations } from "#admin/features/manage-organizations/index.ts";
import { Card } from "@dev-template/ui/card";

export function AdminCreateOrganization() {
  const { can } = usePermissions("platform");
  const mutations = useOrganizationMutations();
  const navigate = useNavigate();
  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <h1 className="text-3xl font-bold">{translate("企業を作成")}</h1>
        <p className="mt-2 text-muted-foreground">
          {translate("作成後に企業のメンバーとアクセス設定を管理できます。")}
        </p>
      </div>
      <Card className="p-6">
        {can("organization.manage") ? (
          <ActionForm
            label={translate("企業を作成")}
            fields={[
              {
                name: "name",
                label: translate("企業名"),
                maxLength: ACCESS_FORM_LIMITS.nameMaxLength,
              },
            ]}
            onSubmit={async (v) => {
              const result = await mutations.createOrganization.mutateAsync({ name: v.name ?? "" });
              await navigate({
                to: "/organizations/$organizationId",
                params: { organizationId: result.id },
              });
            }}
          />
        ) : (
          <p>{translate("企業を作成する権限がありません。")}</p>
        )}
      </Card>
    </div>
  );
}
