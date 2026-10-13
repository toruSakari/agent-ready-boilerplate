import { DashboardInputDto } from "#api/application/dashboard/dtos/dashboard-input-dto.ts";
import { DashboardUseCase } from "#api/application/dashboard/use-cases/dashboard-use-case.ts";
import { D1OrderRepository } from "#api/infrastructure/order/repositories/d1-order-repository.ts";
import { D1ProductRepository } from "#api/infrastructure/product/repositories/d1-product-repository.ts";
import { D1OrganizationRelationsRepository } from "#api/infrastructure/access/repositories/d1-organization-relations-repository.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";
import type { DashboardVisibilityDto } from "#api/application/dashboard/dtos/dashboard-visibility-dto.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";

export function dashboardReader(db: D1Database) {
  const useCase = new DashboardUseCase(
    new D1OrderRepository(db),
    new D1ProductRepository(db),
    new D1OrganizationRelationsRepository(db),
  );
  return {
    summary: async (tenantId: string, visibility: DashboardVisibilityDto) => {
      const permissions: PermissionCode[] = [];
      if (visibility.orders) {
        permissions.push("order:read");
      }

      if (visibility.products) {
        permissions.push("product.read");
      }

      if (visibility.members) {
        permissions.push("member.read");
      }

      return useCase.execute(
        DashboardInputDto.parse({
          actor: await authorizedActor({
            userId: "business:test",
            tenantId,
            role: "member",
            permissions,
          }),
        }),
      );
    },
  };
}
