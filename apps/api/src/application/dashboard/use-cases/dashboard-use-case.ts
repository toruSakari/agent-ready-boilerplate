import { DashboardOutputDto } from "#api/application/dashboard/dtos/dashboard-output-dto.ts";
import type { DashboardInputDto } from "#api/application/dashboard/dtos/dashboard-input-dto.ts";
import type { ProductRepository } from "#api/domain/product/repositories/product-repository.ts";
import type { OrderRepository } from "#api/domain/order/repositories/order-repository.ts";
import type { OrganizationRelationsRepository } from "#api/domain/access/repositories/organization-relations-repository.ts";
import { DashboardSummaryDto } from "#api/application/dashboard/dtos/dashboard-summary-dto.ts";
import { countProducts, countOrders } from "#api/application/dashboard/shared/count-entities.ts";

export class DashboardUseCase {
  constructor(
    private readonly orders: Pick<OrderRepository, "list">,
    private readonly products: Pick<ProductRepository, "list">,
    private readonly memberships: Pick<OrganizationRelationsRepository, "members">,
  ) {}

  async execute(inputDto: DashboardInputDto): Promise<DashboardOutputDto> {
    const { actor } = inputDto;
    const [orders, products, members] = await Promise.all([
      actor.permissions.includes("order:read") ? countOrders(this.orders, actor.tenantId) : null,
      actor.permissions.includes("product.read")
        ? countProducts(this.products, actor.tenantId)
        : null,
      actor.permissions.includes("member.read") ? this.memberships.members([actor.tenantId]) : null,
    ]);
    return DashboardOutputDto.parse(dashboardOutput(orders, products, members?.length ?? null));
  }
}

function dashboardOutput(
  orders: {
    total: number;
    draft: number;
    confirmed: number;
  } | null,
  products: number | null,
  members: number | null,
): DashboardSummaryDto {
  return DashboardSummaryDto.parse({
    ordersTotal: orders?.total ?? null,
    draftCount: orders?.draft ?? null,
    confirmedCount: orders?.confirmed ?? null,
    productsTotal: products,
    membersTotal: members,
  });
}
