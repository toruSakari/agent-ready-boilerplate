import { describe, it, expect } from "vite-plus/test";
import type { AccessRole } from "#client/entities/access";
import { scopeRoleChoices } from "#client/widgets/access-console/model/role-choices";

const roles: AccessRole[] = [
  { id: "owner", name: "オーナー", protectedRole: true, permissions: ["order:read"] },
  { id: "manager", name: "管理担当", protectedRole: false, permissions: ["member.invite"] },
  { id: "customer", name: "顧客", protectedRole: false, permissions: ["order:read"] },
];
describe("メンバー画面のロール候補", () => {
  it("一般ユーザーへの招待候補は返さず、編集候補から保護ロールだけを除く", () => {
    const choices = scopeRoleChoices(roles, "customer");
    expect(choices.invitationOptions).toEqual([]);
    expect(choices.editableRoles.map((props) => props.id)).toEqual(["manager", "customer"]);
    expect(roles.map((props) => props.id)).toEqual(["owner", "manager", "customer"]);
  });
  it.each(["business", "operator"] as const)(
    "%s招待ではオーナーも選べ、元の順序を保つ",
    (category) => {
      expect(scopeRoleChoices(roles, category).invitationOptions).toEqual([
        { value: "owner", label: "オーナー" },
        { value: "manager", label: "管理担当" },
        { value: "customer", label: "顧客" },
      ]);
    },
  );
  it("一覧の取得拒否・未取得では招待と編集の候補を返さない", () => {
    expect(scopeRoleChoices(undefined, "customer")).toEqual({
      invitationOptions: [],
      editableRoles: [],
    });
  });
});
