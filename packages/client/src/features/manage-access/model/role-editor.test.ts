import { describe, it, expect } from "vite-plus/test";
import { rolePermissionOptions } from "#client/features/manage-access/model/role-editor";

describe("ロール編集での権限候補", () => {
  it("プラン外の保存済み権限は解除でき、解除後は再追加できない", () => {
    const catalog = { "order:read": "注文閲覧" };
    const labels = { "product.update": "商品管理" };
    expect(rolePermissionOptions(catalog, labels, ["product.update"], ["product.update"])).toEqual([
      { code: "order:read", label: "注文閲覧", checked: false, disabled: false },
      { code: "product.update", label: "商品管理", checked: true, disabled: false },
    ]);
    expect(rolePermissionOptions(catalog, labels, ["product.update"], []).at(-1)).toEqual({
      code: "product.update",
      label: "商品管理",
      checked: false,
      disabled: true,
    });
  });
  it("編集中にカタログから消えた選択値と未知コードも表示を保持する", () => {
    expect(rolePermissionOptions({}, {}, [], ["unknown", "unknown"])).toEqual([
      { code: "unknown", label: "unknown", checked: true, disabled: false },
    ]);
  });
});
