import { describe, expect, it } from "vite-plus/test";
import { roleSupportsService } from "#client/entities/access/model/service-category";
import type { AccessRole } from "#client/entities/access/model/types";

const customerRole: AccessRole = {
  id: "customer-role",
  name: "旧一般ユーザーロール",
  protectedRole: false,
  permissions: ["order:read", "order:create", "order:update", "product.read"],
};
// 一般ユーザーへの企業ロール付与を候補でも拒否し、企業・運営の候補は維持する。
describe("サービスごとのロール選択肢", () => {
  it("一般ユーザーには専用・閲覧専用の企業ロールも許可しない", () => {
    expect(roleSupportsService(customerRole, "customer")).toBe(false);
    expect(roleSupportsService({ ...customerRole, permissions: ["order:read"] }, "customer")).toBe(
      false,
    );
  });
  it("一般ユーザーの選択肢からオーナーと事業者管理用のロールを除外する", () => {
    expect(roleSupportsService({ ...customerRole, protectedRole: true }, "customer")).toBe(false);
    expect(
      roleSupportsService({ ...customerRole, permissions: ["member.invite"] }, "customer"),
    ).toBe(false);
    expect(
      roleSupportsService({ ...customerRole, permissions: ["product.update"] }, "customer"),
    ).toBe(false);
  });
  it("事業者や運営の選択肢には一般ユーザー向けの制限を適用しない", () => {
    expect(roleSupportsService({ ...customerRole, protectedRole: true }, "business")).toBe(true);
    expect(roleSupportsService({ ...customerRole, permissions: ["user.delete"] }, "operator")).toBe(
      true,
    );
  });
});
