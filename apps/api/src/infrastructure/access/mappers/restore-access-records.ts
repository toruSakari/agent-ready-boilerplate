import { InvitationEntity } from "#api/domain/access/entities/invitation.ts";
import { MembershipEntity } from "#api/domain/access/entities/membership.ts";
import { OrganizationEntity } from "#api/domain/access/entities/organization.ts";
import { RoleEntity } from "#api/domain/access/entities/role.ts";
import type { AccessRecords } from "#api/domain/access/repositories/access-repository.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import { AccountCategoryValue } from "#api/domain/access/value-objects/account-category.ts";
import { AllowedIpRange } from "#api/domain/access/value-objects/allowed-ip-range.ts";
import { PermissionValue } from "#api/domain/access/value-objects/permission.ts";
import { restoreStoredServiceAccount } from "#api/infrastructure/access/mappers/restore-stored-service-account.ts";
import { z } from "zod";

const flag = z.union([z.literal(0), z.literal(1)]).transform((v) => v === 1);
const organizationRow = z.object({
  id: z.unknown(),
  name: z.unknown(),
  active: flag,
  invitations_enabled: flag,
  business_ip_restriction_enabled: flag,
  business_allowed_ips: z.string().transform((v) => z.array(z.string()).parse(JSON.parse(v))),
});
const roleRow = z.object({
  id: z.string(),
  scope: z.string(),
  name: z.unknown(),
  protected_role: flag,
});
const membershipRow = z.object({
  id: z.string(),
  scope: z.string(),
  accounts_id: z.string(),
  access_roles_id: z.string(),
  category: z.enum(["customer", "business", "operator"]),
});
const invitationRow = z.object({
  id: z.string(),
  scope: z.string(),
  email: z.string(),
  access_roles_id: z.string(),
  token_hash: z.string(),
  expires_at: z.iso.datetime(),
  inviter_id: z.string(),
  actor_kind: z.enum(["operator", "business", "customer"]).nullable(),
  inviter_channel: z.enum(["admin", "business"]).nullable(),
});

export function restoreInvitation(value: unknown) {
  const r = invitationRow.parse(value);
  return new InvitationEntity(
    AccessId.create(r.id),
    AccessId.create(r.scope),
    EmailAddress.create(r.email),
    AccessId.create(r.access_roles_id),
    r.token_hash,
    r.expires_at,
    AccessId.create(r.inviter_id),
    r.actor_kind === null ? null : AccountCategoryValue.create(r.actor_kind),
    r.inviter_channel,
  );
}

export function restoreAccessRecords(results: unknown): AccessRecords {
  const result = z.object({ results: z.array(z.unknown()) });
  const [revision, organizations, accounts, roles, permissions, memberships, invitations] = z
    .tuple([result, result, result, result, result, result, result])
    .parse(results);
  const permissionRows = z
    .array(z.object({ access_roles_id: z.string(), permissions_id: z.unknown() }))
    .parse(permissions.results);
  const restoredAccounts = accounts.results.map(restoreStoredServiceAccount);
  return {
    version: z.object({ version: z.number().int().nonnegative() }).parse(revision.results[0])
      .version,
    organizations: organizations.results.map((value) => restoreOrganization(value)),
    customerAccounts: restoredAccounts.filter((account) => account.category === "customer"),
    businessAccounts: restoredAccounts.filter((account) => account.category === "business"),
    operatorAccounts: restoredAccounts.filter((account) => account.category === "operator"),
    roles: roles.results.map((value) => restoreRole(value, permissionRows)),
    memberships: memberships.results.map((value) => restoreMembership(value)),
    invitations: invitations.results.map(restoreInvitation),
  };
}

export function restoreOrganization(value: unknown) {
  const r = organizationRow.parse(value);
  return new OrganizationEntity(
    AccessId.create(r.id),
    AccessName.create(r.name),
    r.active,
    r.invitations_enabled,
    r.business_ip_restriction_enabled,
    r.business_allowed_ips.map((entry) => AllowedIpRange.create(entry)),
  );
}

export function restoreRole(
  value: unknown,
  permissionRows: readonly { access_roles_id: string; permissions_id: unknown }[],
) {
  const r = roleRow.parse(value);
  return new RoleEntity(
    AccessId.create(r.id),
    AccessId.create(r.scope),
    AccessName.create(r.name),
    permissionRows
      .filter((p) => p.access_roles_id === r.id)
      .map((p) => PermissionValue.create(p.permissions_id)),
    r.protected_role,
  );
}

export function restoreMembership(value: unknown) {
  const r = membershipRow.parse(value);
  return new MembershipEntity(
    AccessId.create(r.id),
    AccessId.create(r.scope),
    AccessId.create(r.accounts_id),
    AccessId.create(r.access_roles_id),
    AccountCategoryValue.create(r.category),
  );
}
