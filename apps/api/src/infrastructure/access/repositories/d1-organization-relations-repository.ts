import { PlanAssignment } from "#api/domain/access/entities/plan-assignment.ts";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, inArray } from "drizzle-orm";
import {
  organizations,
  businessAccounts,
  businessMemberships,
} from "#api/infrastructure/access/schemas/schema.ts";
import { restoreMembership } from "#api/infrastructure/access/mappers/restore-access-records.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import type { OrganizationRelationsRepository } from "#api/domain/access/repositories/organization-relations-repository.ts";

export class D1OrganizationRelationsRepository implements OrganizationRelationsRepository {
  private readonly db;

  constructor(binding: D1Database) {
    this.db = drizzle(binding);
  }

  async plans(ids: readonly string[]) {
    if (!ids.length) {
      return [];
    }

    const rows = await this.db
      .select({ id: organizations.id, planCode: organizations.planCode })
      .from(organizations)
      .where(inArray(organizations.id, [...new Set(ids)]));
    return rows.map(
      (row) =>
        new PlanAssignment(
          "business",
          AccessId.create(row.id),
          row.planCode === null ? null : AccessId.create(row.planCode),
        ),
    );
  }

  async members(ids: readonly string[]) {
    if (!ids.length) {
      return [];
    }

    const rows = await this.db
      .select({
        id: businessMemberships.id,
        scope: businessMemberships.organizationsId,
        accounts_id: businessMemberships.businessAccountsId,
        access_roles_id: businessMemberships.accessRolesId,
      })
      .from(businessMemberships)
      .innerJoin(
        businessAccounts,
        and(
          eq(businessAccounts.id, businessMemberships.businessAccountsId),
          eq(businessAccounts.deleted, false),
        ),
      )
      .where(inArray(businessMemberships.organizationsId, [...new Set(ids)]));
    return rows.map((row) => restoreMembership({ ...row, category: "business" }));
  }
}
