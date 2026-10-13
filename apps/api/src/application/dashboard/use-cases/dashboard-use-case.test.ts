import { DashboardInputDto } from "#api/application/dashboard/dtos/dashboard-input-dto.ts";
import { describe, expect, it, vi } from "vite-plus/test";
import { DashboardUseCase } from "#api/application/dashboard/use-cases/dashboard-use-case.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";

describe("企業ダッシュボード", () => {
  it("現在権限に従って企業スコープを渡し、権限外の集計を要求しない", async () => {
    const list = vi.fn().mockResolvedValue([]);
    const products = { list: vi.fn() };
    const memberships = { members: vi.fn() };
    const actor = await authorizedActor({
      userId: "b1",
      tenantId: "tenant-a",
      role: "member",
      permissions: ["order:read"],
    });
    const output = await new DashboardUseCase({ list }, products, memberships).execute(
      DashboardInputDto.parse({
        actor,
      }),
    );
    expect(output).toEqual({
      ordersTotal: 0,
      draftCount: 0,
      confirmedCount: 0,
      productsTotal: null,
      membersTotal: null,
    });
    expect(list).toHaveBeenCalledWith("tenant-a", undefined, { limit: 100, cursor: undefined });
    expect(products.list).not.toHaveBeenCalled();
    expect(memberships.members).not.toHaveBeenCalled();
  });
});
