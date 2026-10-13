"use client";
import { DataErrorBoundary } from "#client/shared/ui/error-boundary";
import { ScopeMemberDirectory } from "#client/widgets/access-console/ui/scope-member-directory";
import { ScopeRoleManagement } from "#client/widgets/access-console/ui/scope-role-management";
import { ScopeAudit } from "#client/widgets/access-console/ui/scope-audit";

/** 各ページが対象の作業だけを選び、取得と復旧の境界も独立させる。 */
export function ScopeMembers(props: {
  scope: string;
  platform?: boolean;
  section?: "all" | "members" | "roles" | "audit";
}) {
  const { scope, platform = false, section = "all" } = props;

  return (
    <section className="grid gap-6">
      {(section === "all" || section === "members") && (
        <DataErrorBoundary>
          <ScopeMemberDirectory scope={scope} platform={platform} />
        </DataErrorBoundary>
      )}
      {(section === "all" || section === "roles") && (
        <DataErrorBoundary>
          <ScopeRoleManagement scope={scope} platform={platform} />
        </DataErrorBoundary>
      )}
      {(section === "all" || section === "audit") && (
        <DataErrorBoundary>
          <ScopeAudit scope={scope} />
        </DataErrorBoundary>
      )}
    </section>
  );
}
