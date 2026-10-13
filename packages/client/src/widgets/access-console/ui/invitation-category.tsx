import { t as translate } from "#client/shared/i18n";
import { NativeSelect, NativeSelectOption } from "@dev-template/ui/native-select";
import { PLATFORM_SCOPE } from "#client/widgets/access-console/ui/access-scope";
import type { useScopeInvitation } from "#client/widgets/access-console/model/use-scope-invitation";

export function InvitationCategory(props: {
  scope: string;
  state: ReturnType<typeof useScopeInvitation>;
}) {
  const { inviteCategory, mutations } = props.state;
  return (
    <NativeSelect
      id={`invite-category-${props.scope}`}
      value={inviteCategory}
      disabled={mutations.invite.isPending}
      onChange={(event) => props.state.changeCategory(event.target.value)}
    >
      {props.scope === PLATFORM_SCOPE ? (
        <NativeSelectOption value="operator">{translate("運営")}</NativeSelectOption>
      ) : (
        <>
          <NativeSelectOption value="business">{translate("事業者")}</NativeSelectOption>
        </>
      )}
    </NativeSelect>
  );
}
