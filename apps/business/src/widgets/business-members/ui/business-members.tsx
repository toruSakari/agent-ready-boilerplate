import { t as translate } from "@dev-template/client/i18n";
import type { ReactNode } from "react";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { useOrganizationId } from "@dev-template/client/api";
import { ScopeMembers } from "@dev-template/client/access";
import { BusinessShell } from "#business/widgets/business-shell/index.ts";

export function BusinessMembers(props: {
  navigation?: ReactNode;
  section?: "members" | "roles" | "audit";
}) {
  const { navigation: _navigation, section = "members" } = props;

  const scope = useOrganizationId();
  let title;
  if (section === "roles") {
    title = translate("ロール・権限");
  } else {
    if (section === "audit") {
      title = translate("監査履歴");
    } else {
      title = translate("メンバー・権限");
    }
  }

  return (
    <BusinessShell
      title={title}
      description={translate("企業のメンバー、招待、アクセス権限を管理します。")}
    >
      <DataErrorBoundary key={scope} loadingLabel={translate("メンバー・権限を読み込み中…")}>
        <ScopeMembers scope={scope} section={section} />
      </DataErrorBoundary>
    </BusinessShell>
  );
}
