import { t as translate } from "#client/shared/i18n";
import type { AccessRole } from "#client/entities/access";
import { RoleEditor, useAccessMutations } from "#client/features/manage-access";
import { useService } from "#client/shared/api/client-context";

export function ScopeRoleEditors(props: {
  scope: string;
  catalog: Record<string, string>;
  roles: readonly AccessRole[];
  permissionLabels: Record<string, string>;
}) {
  const service = useService(["business", "operator"]);
  const mutations = useAccessMutations();
  return (
    <>
      <RoleEditor
        catalog={props.catalog}
        onSubmit={async (input) => {
          await mutations.saveRole.mutateAsync({ service, scope: props.scope, ...input });
        }}
      />
      {props.roles.map((r) => (
        <section
          key={`${r.id}:${r.name}:${r.permissions.join(",")}`}
          className="border-t border-border pt-4"
        >
          <h4>{translate("{{name}}を編集", { name: r.name })}</h4>
          <RoleEditor
            catalog={props.catalog}
            permissionLabels={props.permissionLabels}
            initial={{ name: r.name, permissions: [...r.permissions] }}
            onSubmit={async (input) => {
              await mutations.saveRole.mutateAsync({
                service,
                scope: props.scope,
                id: r.id,
                ...input,
              });
            }}
          />
        </section>
      ))}
    </>
  );
}
