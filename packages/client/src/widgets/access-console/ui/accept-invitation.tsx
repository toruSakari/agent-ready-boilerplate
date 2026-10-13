"use client";
import { t as translate } from "#client/shared/i18n";
import { useInvitationAcceptance } from "#client/widgets/access-console/ui/use-invitation-acceptance";
import { InvitationAcceptanceForm } from "#client/widgets/access-console/ui/invitation-acceptance-form";
import { Button } from "@dev-template/ui/button";
import { Alert, AlertDescription } from "@dev-template/ui/alert";
import { ConsoleLayout } from "#client/widgets/access-console/ui/console-layout";
import { PLATFORM_SCOPE } from "#client/widgets/access-console/ui/access-scope";

export function AcceptInvitation() {
  const state = useInvitationAcceptance();
  const { showAccepted, accepted, invitation, error } = state;
  let content;
  if (showAccepted) {
    content = (
      <>
        <p>{translate("招待を承諾しました。")}</p>
        <Button asChild>
          <a
            href={
              accepted === PLATFORM_SCOPE ? "/" : `/organizations/${encodeURIComponent(accepted)}`
            }
          >
            {translate("利用を開始")}
          </a>
        </Button>
      </>
    );
  } else {
    if (!invitation) {
      content = (
        <Alert variant="destructive">
          <AlertDescription>
            {error === "storage"
              ? translate(
                  "招待を一時保存できません。このサイトのブラウザー保存を許可して、招待リンクを開き直してください。",
                )
              : translate(
                  "招待リンクが無効か見つかりません。招待リンクを開き直すか、発行者に再発行を依頼してください。",
                )}
          </AlertDescription>
        </Alert>
      );
    } else {
      content = <InvitationAcceptanceForm state={state} />;
    }
  }

  return <ConsoleLayout title={translate("企業・運営への招待を承諾")}>{content}</ConsoleLayout>;
}
