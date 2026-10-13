import { PermissionGate } from "@dev-template/client/entities/access";
import { BusinessMembers } from "#business/widgets/business-members/index.ts";

export function Page() {
  return (
    <PermissionGate required={["role.manage"]}>
      <BusinessMembers section="roles" />
    </PermissionGate>
  );
}
