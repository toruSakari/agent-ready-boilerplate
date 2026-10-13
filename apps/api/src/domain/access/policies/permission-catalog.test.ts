import { describe, expect, it } from "vite-plus/test";
import {
  PERMISSIONS,
  PERMISSION_CODES,
  PLATFORM_PERMISSIONS,
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";

describe("サービスごとの権限上限", () => {
  it("運営の上限に企業・顧客向け業務権限を追加しない", () => {
    expect(PLATFORM_PERMISSIONS).toEqual([
      "organization.read",
      "organization.manage",
      "user.read",
      "user.personal.read",
      "user.delete",
      "plan.manage",
      "member.read",
      "member.invite",
      "member.assign_role",
      "member.remove",
      "role.manage",
      "audit.read",
    ]);
  });
  it("企業の上限に運営専用権限を追加しない", () => {
    expect(BUSINESS_PERMISSIONS).toEqual([
      "member.read",
      "member.invite",
      "member.assign_role",
      "member.remove",
      "role.manage",
      "audit.read",
      "order:read",
      "order:update",
      "product.read",
      "product.update",
    ]);
  });
  it("顧客の上限に企業管理・商品編集権限を追加しない", () => {
    expect(CUSTOMER_PERMISSIONS).toEqual([
      "order:read",
      "order:create",
      "order:update",
      "product.read",
    ]);
  });
  it("コードの重複と表示名の欠落を防ぐ", () => {
    expect(new Set(PERMISSION_CODES).size).toBe(PERMISSION_CODES.length);
    for (const code of PERMISSION_CODES) {
      expect(PERMISSIONS[code]).toMatch(/\S/);
    }
  });
});
