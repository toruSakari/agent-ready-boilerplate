import { t as translate } from "#client/shared/i18n";
import { ActionForm, ACCESS_FORM_LIMITS, INVITATION_PATH } from "#client/features/manage-access";
import { signInUrl } from "#client/shared/config/auth-routes";
import { Button } from "@dev-template/ui/button";
import type { useInvitationAcceptance } from "#client/widgets/access-console/ui/use-invitation-acceptance";

export function InvitationAcceptanceForm(props: {
  state: ReturnType<typeof useInvitationAcceptance>;
}) {
  const { authentication, revision } = props.state;
  let content;
  if (authentication === "loading") {
    content = <p>{translate("認証情報を確認しています…")}</p>;
  } else {
    if (authentication === "signed-out") {
      content = (
        <Button asChild>
          <a href={signInUrl(INVITATION_PATH)}>{translate("ログインして招待を確認")}</a>
        </Button>
      );
    } else {
      content = (
        <ActionForm
          key={revision}
          label={translate("招待を承諾")}
          fields={[
            {
              name: "name",
              label: translate("表示名"),
              maxLength: ACCESS_FORM_LIMITS.nameMaxLength,
            },
          ]}
          onSubmit={props.state.accept}
        />
      );
    }
  }

  return (
    <>
      <p>
        {translate(
          "招待されたメールアドレスのアカウントでログインし、メールの確認を済ませてください。",
        )}
      </p>
      {content}
      <Button variant="outline" onClick={props.state.close}>
        {translate("招待を閉じる")}
      </Button>
    </>
  );
}
