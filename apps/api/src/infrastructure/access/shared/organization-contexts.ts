import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  organizations,
  accessRoles,
  rolePermissions,
} from "#api/infrastructure/access/schemas/schema.ts";
import {
  accessMemberships,
  accessAccounts,
  accountCategoryColumn,
  accountDeletedColumn,
  membershipCategoryColumn,
  storedColumns,
} from "#api/infrastructure/access/shared/access-record-selections.ts";
import {
  restoreOrganization,
  restoreRole,
} from "#api/infrastructure/access/mappers/restore-access-records.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";

export async function organizationContexts(
  db: DrizzleD1Database,
  userId: string,
  category: AccountCategoryCode,
) {
  if (category === "customer") {
    return [];
  }

  const m = accessMemberships(db);
  const a = accessAccounts(db);
  const rows = await db
    .select({
      organization: storedColumns(organizations),
      role: storedColumns(accessRoles),
      permission: rolePermissions.permissionsId,
    })
    .from(m)
    .innerJoin(a, and(eq(a.id, m.accounts_id), eq(accountCategoryColumn, membershipCategoryColumn)))
    .innerJoin(organizations, eq(organizations.id, m.scope))
    .innerJoin(
      accessRoles,
      and(eq(accessRoles.id, m.access_roles_id), eq(accessRoles.scope, m.scope)),
    )
    .leftJoin(rolePermissions, eq(rolePermissions.accessRolesId, accessRoles.id))
    .where(
      and(
        eq(m.accounts_id, userId),
        eq(membershipCategoryColumn, category),
        eq(accountDeletedColumn, 0),
        eq(organizations.active, true),
      ),
    )
    .orderBy(asc(organizations.name), asc(organizations.id));
  return restoreContexts(rows);
}

function restoreContexts(
  rows: {
    organization: Record<string, unknown>;
    role: Record<string, unknown>;
    permission: string | null;
  }[],
) {
  const grouped = new Map<
    string,
    {
      organization: ReturnType<typeof restoreOrganization>;
      role: Record<string, unknown>;
      permissions: { access_roles_id: string; permissions_id: string }[];
    }
  >();
  for (const row of rows) {
    const key = JSON.stringify([row.organization.id, row.role.id]);
    let group = grouped.get(key);
    if (!group) {
      group = {
        organization: restoreOrganization(row.organization),
        role: row.role,
        permissions: [],
      };
      grouped.set(key, group);
    }

    if (row.permission !== null) {
      group.permissions.push({
        access_roles_id: String(row.role.id),
        permissions_id: row.permission,
      });
    }
  }

  return [...grouped.values()].map((group) => ({
    organization: group.organization,
    role: restoreRole(group.role, group.permissions),
  }));
}
