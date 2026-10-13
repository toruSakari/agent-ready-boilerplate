import { t as translate } from "@dev-template/client/i18n";
import { ScopeMembers } from "@dev-template/client/access";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";

export function AdminAccess(props: { section?: "members" | "roles" | "audit" }) {
  const { section = "members" } = props;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-bold">
          {translate(
            { roles: "運営ロール管理", audit: "運営監査ログ", members: "運営メンバー管理" }[
              section
            ],
          )}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {translate("運営への招待、ロール、監査履歴を管理します。")}
        </p>
      </div>
      <DataErrorBoundary loadingLabel={translate("メンバー・権限を読み込み中…")}>
        <ScopeMembers scope="platform" platform section={section} />
      </DataErrorBoundary>
    </div>
  );
}
