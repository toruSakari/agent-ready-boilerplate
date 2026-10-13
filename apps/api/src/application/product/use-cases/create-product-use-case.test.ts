import { CreateProductInputDto } from "#api/application/product/dtos/create-product-input-dto.ts";
import { parseInputDto } from "#api/application/shared/parse-input-dto.ts";
import { expect, it, vi } from "vite-plus/test";
import { CreateProductUseCase } from "#api/application/product/use-cases/create-product-use-case.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";

const actor = () =>
  authorizedActor({ userId: "merchant", tenantId: "shop", role: "admin", permissions: [] });
it.each([0, 3, 900])("初期在庫%dを企業の商品と同時に登録する", async (initialStock) => {
  const register = vi.fn();
  const product = await new CreateProductUseCase({ register }).execute(
    CreateProductInputDto.parse({
      actor: await actor(),
      input: {
        sku: "S1",
        name: "商品",
        unitPrice: 100,
        initialStock,
      },
    }),
  );
  expect(product.tenantId).toBe("shop");
  expect(register).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: "shop", sku: "S1" }),
    initialStock,
    "merchant",
  );
});
it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN])(
  "不正な初期在庫%dでは書き込まない",
  async (initialStock) => {
    const register = vi.fn();
    await expect(
      (async () =>
        new CreateProductUseCase({ register }).execute(
          parseInputDto(CreateProductInputDto, {
            actor: await actor(),
            input: { sku: "S1", name: "商品", unitPrice: 100, initialStock },
          }),
        ))(),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(register).not.toHaveBeenCalled();
  },
);
it("旧クライアントが初期在庫を省略した場合は0個で登録する", async () => {
  const register = vi.fn();
  await new CreateProductUseCase({ register }).execute(
    CreateProductInputDto.parse({
      actor: await actor(),
      input: {
        sku: "S1",
        name: "商品",
        unitPrice: 100,
      },
    }),
  );
  expect(register).toHaveBeenCalledWith(expect.anything(), 0, "merchant");
});
