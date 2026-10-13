"use client";
import { t as translate } from "#client/shared/i18n";
import { ScopeMemberCard } from "#client/widgets/access-console/ui/scope-member-card";
import { ScopeInvitation } from "#client/widgets/access-console/ui/scope-invitation";
import { usePermissions, useMembers, useRoles } from "#client/entities/access";
import { useService } from "#client/shared/api/client-context";

export function ScopeMemberDirectory(props: { scope: string; platform?: boolean }) {
  const { scope, platform = false } = props;

  const service = useService(["business", "operator"]);
  const { can } = usePermissions(platform ? "platform" : "organization");
  const canReadEmail = service !== "operator" || can("user.personal.read");
  const members = useMembers(scope);
  const roles = useRoles(scope);
  // APIの手続きごとの拒否を使う。拒否した一覧だけを隠し、通信障害はエラーとして残す。
  const rolesForbidden = roles.data === null;
  // 再取得で403になった場合は、キャッシュに残っているロールも選択肢として再利用しない。
  const visibleRoles = roles.data ?? undefined;
  return (
    <section className="grid gap-4">
      {members.data !== null && (
        <>
          <h2 className="text-xl font-semibold">{translate("メンバー・権限管理")}</h2>

          {members.data.map((m) => (
            <ScopeMemberCard
              key={m.id}
              member={m}
              scope={scope}
              canReadEmail={canReadEmail}
              canAssignRole={can("member.assign_role") && !rolesForbidden}
              canRemove={can("member.remove")}
              visibleRoles={visibleRoles}
            />
          ))}
        </>
      )}
      {can("member.invite") && !rolesForbidden && (
        <ScopeInvitation scope={scope} visibleRoles={visibleRoles} />
      )}
    </section>
  );
}
