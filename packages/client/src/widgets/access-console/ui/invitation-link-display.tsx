import { t as translate } from "#client/shared/i18n";
import { Input } from "@dev-template/ui/input";
import { Label } from "@dev-template/ui/label";

export function InvitationLinkDisplay(props: { scope: string; inviteLink: string }) {
  return (
    <>
      {" "}
      {props.inviteLink && (
        <>
          <Label htmlFor={`invite-${props.scope}`}>
            {translate("招待リンク（本人に共有してください）")}
          </Label>
          <Input id={`invite-${props.scope}`} readOnly value={props.inviteLink} />
          <p>{translate("招待リンクは一度だけ表示されます。有効期限は7日間です。")}</p>
        </>
      )}
    </>
  );
}
