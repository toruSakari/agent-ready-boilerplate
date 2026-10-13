import type { OrganizationEntity } from "#api/domain/access/entities/organization.ts";
import type { OrganizationFilters } from "#api/domain/shared/list-filters.ts";

export interface OrganizationRepository {
  list(
    filters: OrganizationFilters,
    page: { limit: number; afterId?: string },
  ): Promise<OrganizationEntity[]>;
  findMany(ids: readonly string[]): Promise<OrganizationEntity[]>;
}
