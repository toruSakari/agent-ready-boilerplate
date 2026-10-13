import { PermissionGate } from "@dev-template/client/entities/access";
import { BusinessMembers } from "#business/widgets/business-members/index.ts";

export function Page() {
  return (
    <PermissionGate required={["audit.read"]}>
      <BusinessMembers section="audit" />
    </PermissionGate>
  );
}
