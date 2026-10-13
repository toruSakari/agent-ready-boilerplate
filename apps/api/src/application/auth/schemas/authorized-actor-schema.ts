import { z } from "zod";
import type { AuthorizedActor } from "#api/application/auth/contracts/authorized-actor.ts";
import { permissionCodeSchema } from "#api/domain/access/policies/permission-catalog.ts";
import { identitySchema } from "#api/application/auth/contracts/identity.ts";
import { serviceActorSchema } from "#api/application/auth/contracts/service-actor.ts";
import { OrganizationEntity } from "#api/domain/access/entities/organization.ts";
import { RoleEntity } from "#api/domain/access/entities/role.ts";
import { MembershipEntity } from "#api/domain/access/entities/membership.ts";
import { InvitationEntity } from "#api/domain/access/entities/invitation.ts";
import { CustomerAccountEntity } from "#api/domain/access/entities/customer-account.ts";
import { BusinessAccountEntity } from "#api/domain/access/entities/business-account.ts";
import { OperatorAccountEntity } from "#api/domain/access/entities/operator-account.ts";

const permissions = z.array(permissionCodeSchema);
const snapshot = z.object({
  scope: z.string(),
  state: z.object({
    version: z.number().int().nonnegative(),
    organizations: z.array(z.instanceof(OrganizationEntity)),
    customerAccounts: z.array(z.custom((value) => value instanceof CustomerAccountEntity)),
    businessAccounts: z.array(z.custom((value) => value instanceof BusinessAccountEntity)),
    operatorAccounts: z.array(z.custom((value) => value instanceof OperatorAccountEntity)),
    roles: z.array(z.instanceof(RoleEntity)),
    memberships: z.array(z.instanceof(MembershipEntity)),
    invitations: z.array(z.instanceof(InvitationEntity)),
  }),
});
const actor = identitySchema.unwrap().extend({
  ...serviceActorSchema.unwrap().shape,
  rolePermissions: permissions,
  protectedRole: z.boolean(),
  platform: z.boolean(),
  accessSnapshot: snapshot.optional(),
});
/** DTO検証では認可済みのEntity群と更新番号を検査するが、状態の参照とクラスを作り直さない。認可自体は通信境界とUseCaseが担う。 */
export const authorizedActorSchema = z.custom<AuthorizedActor>(
  (value) => actor.safeParse(value).success,
);
