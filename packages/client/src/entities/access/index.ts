export { useAccessSession } from "#client/entities/access/api/use-access";
export type { AccessSession, AccessRole, AccessMember } from "#client/entities/access/model/types";
export {
  useMembers,
  useRoles,
  useRolePermissionCatalog,
  useAudit,
} from "#client/entities/access/api/use-directory";
export { useServiceRegistration } from "#client/entities/access/api/use-service-registration";
export { MissingServiceRegistration } from "#client/entities/access/ui/missing-service-registration";
export {
  SERVICE_CATEGORY_LABELS,
  roleSupportsService,
} from "#client/entities/access/model/service-category";
export type { ServiceRegistration, ServiceCategory } from "#client/entities/access/model/types";
export { usePermissions } from "#client/entities/access/api/use-permissions";
export { hasPermissions } from "#client/entities/access/model/permissions";
export type { PermissionMode, PermissionScope } from "#client/entities/access/model/permissions";
export type { Permission } from "#client/entities/access/model/types";
export { PermissionGate } from "#client/entities/access/ui/permission-gate";
export type { PermissionGateProps } from "#client/entities/access/ui/permission-gate";

export { permissionLabel } from "#client/entities/access/model/permission-label";
