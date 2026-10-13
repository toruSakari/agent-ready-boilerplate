import { InvitationLinkDisplay } from "#client/widgets/access-console/ui/invitation-link-display";
import { t as translate } from "#client/shared/i18n";
import { ActionForm, ACCESS_FORM_LIMITS } from "#client/features/manage-access";
import { Card } from "@dev-template/ui/card";
import { Label } from "@dev-template/ui/label";
import type { AccessRole } from "#client/entities/access";
import { useScopeInvitation } from "#client/widgets/access-console/model/use-scope-invitation";
import { InvitationCategory } from "#client/widgets/access-console/ui/invitation-category";

export function ScopeInvitation(props: {
  scope: string;
  visibleRoles: readonly AccessRole[] | undefined;
}) {
  const state = useScopeInvitation(props.scope, props.visibleRoles);
  const { inviteCategory, inviteLink, invitationOptions } = state;
  return (
    <Card className="grid gap-3 p-5">
      <h3 className="font-semibold">{translate("ユーザーを招待")}</h3>
      <Label htmlFor={`invite-category-${props.scope}`}>{translate("登録先サービス")}</Label>
      <InvitationCategory scope={props.scope} state={state} />
      <ActionForm
        key={inviteCategory}
        label={translate("招待を発行")}
        fields={[
          {
            name: "email",
            label: translate("メールアドレス"),
            type: "email",
            maxLength: ACCESS_FORM_LIMITS.emailMaxLength,
          },
          {
            name: "roleId",
            label: translate("招待するロール"),
            options: invitationOptions,
          },
        ]}
        onSubmit={state.submit}
      />
      <InvitationLinkDisplay scope={props.scope} inviteLink={inviteLink} />
    </Card>
  );
}
