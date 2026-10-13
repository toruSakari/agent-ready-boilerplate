import { expect, it } from "vite-plus/test";
import { ZodError } from "zod";
import { ProductGetInputDto } from "#api/application/product/dtos/product-get-input-dto.ts";
import { ProductListOutputDto } from "#api/application/product/dtos/product-list-output-dto.ts";
import { ManageStockGetOutputDto } from "#api/application/inventory/dtos/manage-stock-get-output-dto.ts";
import { parseInputDto } from "#api/application/shared/parse-input-dto.ts";
import { toRpcError, publicErrorCode } from "#api/presentation/shared/errors.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";
import { productEntity } from "#api/test/domain-values.ts";

async function input() {
  return {
    identity: {
      ...(await authorizedActor({
        userId: "member",
        tenantId: "company",
        channel: "business",
        role: "admin",
        permissions: ["product.read", "member.read"],
      })),
      accessSnapshot: {
        scope: "company",
        state: {
          version: 0,
          organizations: [],
          customerAccounts: [],
          businessAccounts: [],
          operatorAccounts: [],
          roles: [],
          memberships: [],
          invitations: [],
        },
      },
    },
    id: "product",
  };
}

it("入力の型を検証し、認可済みactorのEntityと更新番号の参照を保つ", async () => {
  const source = await input();
  const dto = ProductGetInputDto.parse(source);
  expect(dto.identity).toBe(source.identity);
  expect(dto.identity.accessSnapshot).toBe(source.identity.accessSnapshot);
  expect(dto).toEqual(source);
  expect(Object.isFrozen(dto)).toBe(true);
});
it("未検証の入力値は入口で400にし、Zodの内部詳細を公開しない", async () => {
  const source = await input();
  expect(() => ProductGetInputDto.parse({ ...source, id: 42 })).toThrow(ZodError);
  try {
    parseInputDto(ProductGetInputDto, { ...source, identity: undefined });
    throw new Error("不正な入力が通過しました");
  } catch (error) {
    expect(publicErrorCode(toRpcError(error))).toBe("BAD_REQUEST");
    expect(toRpcError(error).message).toContain("入力内容が不正");
  }
});
it("偽のEntityを含む認可状態をDTOとして受け入れない", async () => {
  const source = await input();
  const identity = {
    ...source.identity,
    accessSnapshot: {
      scope: "company",
      state: { ...source.identity.accessSnapshot!.state, organizations: [{ id: "fake" }] },
    },
  };
  expect(ProductGetInputDto.safeParse({ ...source, identity }).success).toBe(false);
});
it("一覧の全項目を検査してDTOにし、JSONにはブランドを追加しない", () => {
  const product = productEntity({ sku: "SKU", name: "商品", unitPrice: 100 }).toSnapshot();
  const dto = ProductListOutputDto.parse({ items: [product] });
  expect(JSON.parse(JSON.stringify(dto))).toEqual({ items: [product] });
  expect(
    ProductListOutputDto.safeParse({ items: [product, { ...product, unitPrice: "invalid" }] })
      .success,
  ).toBe(false);
});
it("出力の不正は400へ変換せず内部障害として扱う", () => {
  const result = ManageStockGetOutputDto.safeParse({
    onHand: "invalid",
    reserved: 0,
    available: 0,
  });
  expect(result.success).toBe(false);
  if (result.success) {
    throw new Error("不正な出力が通過しました");
  }

  expect(publicErrorCode(toRpcError(result.error))).toBe("INTERNAL_SERVER_ERROR");
});
