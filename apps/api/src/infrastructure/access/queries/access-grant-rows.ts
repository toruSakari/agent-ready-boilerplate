import type { DrizzleD1Database } from "drizzle-orm/d1";
import { and, or, eq, sql } from "drizzle-orm";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import {
  accessAccounts,
  accessMemberships,
  accountCategoryColumn,
  accountDeletedColumn,
  membershipCategoryColumn,
} from "#api/infrastructure/access/shared/access-record-selections.ts";
import {
  accessRoles,
  rolePermissions,
  organizations,
  customerAccounts,
} from "#api/infrastructure/access/schemas/schema.ts";

export async function grantRows(db: DrizzleD1Database, userId: string, scope: string) {
  const m = accessMemberships(db);
  const a = accessAccounts(db);
  const rows = await db
    .select({
      protected_role: sql`${accessRoles.protectedRole}`,
      permissions_id: rolePermissions.permissionsId,
      category: membershipCategoryColumn,
      plan_code: sql`case when ${membershipCategoryColumn}='business' then ${organizations.planCode} when ${membershipCategoryColumn}='customer' then ${customerAccounts.planCode} else null end`,
    })
    .from(m)
    .innerJoin(a, and(eq(a.id, m.accounts_id), eq(accountCategoryColumn, membershipCategoryColumn)))
    .innerJoin(
      accessRoles,
      and(eq(accessRoles.id, m.access_roles_id), eq(accessRoles.scope, m.scope)),
    )
    .leftJoin(rolePermissions, eq(rolePermissions.accessRolesId, accessRoles.id))
    .leftJoin(organizations, eq(organizations.id, m.scope))
    .leftJoin(
      customerAccounts,
      and(eq(membershipCategoryColumn, "customer"), eq(customerAccounts.id, m.accounts_id)),
    )
    .where(
      and(
        eq(m.accounts_id, userId),
        eq(m.scope, scope),
        eq(accountDeletedColumn, 0),
        or(eq(m.scope, PLATFORM_SCOPE), eq(organizations.active, true)),
      ),
    );
  return rows;
}
