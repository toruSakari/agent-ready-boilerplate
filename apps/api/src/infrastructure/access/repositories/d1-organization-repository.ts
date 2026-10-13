import { textSearch } from "#api/infrastructure/shared/list-conditions.ts";
import type { OrganizationFilters } from "#api/domain/shared/list-filters.ts";
import { drizzle } from "drizzle-orm/d1";
import { inArray, and, asc, eq, gt, isNull } from "drizzle-orm";
import { organizations } from "#api/infrastructure/access/schemas/schema.ts";
import { storedColumns } from "#api/infrastructure/access/shared/access-record-selections.ts";
import { restoreOrganization } from "#api/infrastructure/access/mappers/restore-access-records.ts";
import type { OrganizationRepository } from "#api/domain/access/repositories/organization-repository.ts";

export class D1OrganizationRepository implements OrganizationRepository {
  private readonly db;

  constructor(binding: D1Database) {
    this.db = drizzle(binding);
  }

  async list(filters: OrganizationFilters, page: { limit: number; afterId?: string }) {
    let planCondition;
    if (filters.planCode === "unassigned") {
      planCondition = isNull(organizations.planCode);
    } else if (filters.planCode) {
      planCondition = eq(organizations.planCode, filters.planCode);
    }

    const rows = await this.db
      .select(storedColumns(organizations))
      .from(organizations)
      .where(
        and(
          textSearch([organizations.name], filters.search),
          filters.status ? eq(organizations.active, filters.status === "active") : undefined,
          planCondition,
          page.afterId ? gt(organizations.id, page.afterId) : undefined,
        ),
      )
      .orderBy(asc(organizations.id))
      .limit(page.limit + 1);
    return rows.map(restoreOrganization);
  }

  async findMany(ids: readonly string[]) {
    if (!ids.length) {
      return [];
    }

    const unique = [...new Set(ids)];
    const statements = [];
    for (let i = 0; i < unique.length; i += 100) {
      statements.push(
        this.db
          .select(storedColumns(organizations))
          .from(organizations)
          .where(inArray(organizations.id, unique.slice(i, i + 100))),
      );
    }

    const [first, ...rest] = statements;
    if (!first) {
      return [];
    }

    return (await this.db.batch([first, ...rest])).flat().map(restoreOrganization);
  }
}
