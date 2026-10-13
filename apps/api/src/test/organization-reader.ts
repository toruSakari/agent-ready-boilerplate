import { ListOrganizationDirectoryInputDto } from "#api/application/access/dtos/list-organization-directory-input-dto.ts";
import { D1OrganizationRepository } from "#api/infrastructure/access/repositories/d1-organization-repository.ts";
import { D1OrganizationRelationsRepository } from "#api/infrastructure/access/repositories/d1-organization-relations-repository.ts";
import { ListOrganizationDirectoryUseCase } from "#api/application/access/use-cases/list-organization-directory-use-case.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";

export function organizationReader(db: D1Database) {
  const useCase = new ListOrganizationDirectoryUseCase(
    new D1OrganizationRepository(db),
    new D1OrganizationRelationsRepository(db),
  );
  return {
    list: async (
      filters: import("#api/domain/shared/list-filters.ts").OrganizationFilters,
      page: {
        limit: number;
        afterId?: string;
      },
    ) =>
      await useCase.execute(
        ListOrganizationDirectoryInputDto.parse({
          actor: await authorizedActor({
            userId: "operator:test",
            tenantId: "",
            channel: "admin",
            role: "admin",
            permissions: ["organization.read"],
          }),
          filters,
          page,
        }),
      ),
  };
}
