"use client";
import { t as translate } from "@dev-template/client/i18n";
import type { AccessOrganization } from "#admin/entities/directory/index.ts";
import { useOrganizationMutations } from "#admin/features/manage-organizations/api/use-organization-mutations.ts";
import { ActionForm, AccessAction, ACCESS_FORM_LIMITS } from "@dev-template/client/manage-access";
import { Card } from "@dev-template/ui/card";
import { Badge } from "@dev-template/ui/badge";

/** organization.manageを許可された親画面から使う。操作の最終的な認可はAPIが行う。 */
export function OrganizationSettings(props: { organization: AccessOrganization }) {
  const mutations = useOrganizationMutations();
  const toggleInvitations = () =>
    mutations.updateOrganization.mutateAsync({
      ...props.organization,
      invitationsEnabled: !props.organization.invitationsEnabled,
    });
  const toggleActive = () =>
    mutations.updateOrganization.mutateAsync({
      ...props.organization,
      active: !props.organization.active,
    });
  return (
    <Card className="grid gap-3 p-5">
      <h2 className="text-xl font-semibold">{props.organization.name}</h2>
      <Badge>{props.organization.active ? translate("利用中") : translate("利用停止")}</Badge>
      <p>{translate("所属人数：{{count}}", { count: props.organization.memberCount })}</p>
      {/* 保存後に返った企業名でフォームを作り直し、以前の初期入力を保持し続けない。 */}
      <ActionForm
        key={props.organization.name}
        label={translate("企業名を変更")}
        fields={[
          {
            name: "name",
            label: translate("企業名"),
            initial: props.organization.name,
            maxLength: ACCESS_FORM_LIMITS.nameMaxLength,
          },
        ]}
        onSubmit={async (v) => {
          await mutations.updateOrganization.mutateAsync({
            ...props.organization,
            name: v.name ?? "",
          });
        }}
      />
      <AccessAction
        label={
          props.organization.invitationsEnabled
            ? translate("企業からの招待を無効にする")
            : translate("企業からの招待を許可する")
        }
        onAction={toggleInvitations}
      />
      <AccessAction
        label={
          props.organization.active ? translate("企業を利用停止") : translate("企業の利用を再開")
        }
        confirmation={
          props.organization.active
            ? translate("{{name}}の利用を停止しますか？", { name: props.organization.name })
            : undefined
        }
        onAction={toggleActive}
      />
    </Card>
  );
}
