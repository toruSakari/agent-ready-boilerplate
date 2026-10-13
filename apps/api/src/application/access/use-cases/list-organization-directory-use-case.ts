import { ListOrganizationDirectoryOutputDto } from "#api/application/access/dtos/list-organization-directory-output-dto.ts";
import type { ListOrganizationDirectoryInputDto } from "#api/application/access/dtos/list-organization-directory-input-dto.ts";
import type { OrganizationRepository } from "#api/domain/access/repositories/organization-repository.ts";
import type { OrganizationRelationsRepository } from "#api/domain/access/repositories/organization-relations-repository.ts";
import { OrganizationDirectoryItemDto } from "#api/application/access/dtos/organization-directory-output.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

export class ListOrganizationDirectoryUseCase {
  constructor(
    private readonly organizations: Pick<OrganizationRepository, "list">,
    private readonly relations: OrganizationRelationsRepository,
  ) {}

  async execute(
    inputDto: ListOrganizationDirectoryInputDto,
  ): Promise<ListOrganizationDirectoryOutputDto> {
    const { actor, filters, page } = inputDto;
    if (actor.channel !== "admin" || !actor.platform) {
      throw new ApplicationError({ code: "FORBIDDEN", message: "運営の権限が必要です" });
    }

    const rows = await this.organizations.list(filters, page);
    const organizations = rows.slice(0, page.limit);
    const ids = organizations.map((organization) => String(organization.id));
    const [plans, members] = await Promise.all([
      this.relations.plans(ids),
      this.relations.members(ids),
    ]);
    const planCodes = new Map(
      plans.map((plan) => [String(plan.id), plan.planCode === null ? null : String(plan.planCode)]),
    );
    const counts = new Map<string, number>();
    for (const member of members) {
      counts.set(member.scope, (counts.get(member.scope) ?? 0) + 1);
    }

    const items: OrganizationDirectoryItemDto[] = organizations.map((organization) =>
      OrganizationDirectoryItemDto.parse({
        id: String(organization.id),
        name: String(organization.name),
        active: organization.active,
        invitationsEnabled: organization.invitationsEnabled,
        planCode: planCodes.get(organization.id) ?? null,
        memberCount: counts.get(organization.id) ?? 0,
      }),
    );
    return ListOrganizationDirectoryOutputDto.parse({
      items,
      nextId: rows.length > page.limit ? items.at(-1)!.id : null,
    });
  }
}
