import {
  assertCustomerRole,
  inputValues,
} from "#api/application/access/shared/access-use-case-support.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import { AllowedIpRange } from "#api/domain/access/value-objects/allowed-ip-range.ts";
import { PermissionValue } from "#api/domain/access/value-objects/permission.ts";
import { expect, it } from "vite-plus/test";

const customerRoles: { permissions: readonly PermissionCode[] }[] = [
  { permissions: [] },
  { permissions: ["order:read"] },
  { permissions: ["order:read", "order:create", "order:update", "product.read"] },
];

it.each(customerRoles)(
  "通常会員に付与できるロール / 通常会員の権限だけを持つ非保護ロールを許可する: $permissions",
  (props) => {
    expect(() =>
      assertCustomerRole({
        permissions: props.permissions.map(PermissionValue.create),
        protectedRole: false,
      }),
    ).not.toThrow();
  },
);

it.each(customerRoles)(
  "通常会員に付与できるロール / 権限が通常会員の範囲内でも保護ロールを拒否する: $permissions",
  (props) => {
    expect(() =>
      assertCustomerRole({
        permissions: props.permissions.map(PermissionValue.create),
        protectedRole: true,
      }),
    ).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  },
);

const elevatedPermissions: readonly PermissionCode[] = [
  "organization.read",
  "organization.manage",
  "user.read",
  "user.personal.read",
  "user.delete",
  "member.read",
  "member.invite",
  "member.assign_role",
  "member.remove",
  "role.manage",
  "audit.read",
  "product.update",
];

it.each(elevatedPermissions)(
  "通常会員に付与できるロール / 通常会員向けでない権限%sを含むロールを拒否する",
  (permission) => {
    expect(() =>
      assertCustomerRole({
        permissions: ["order:read", permission].map(PermissionValue.create),
        protectedRole: false,
      }),
    ).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  },
);

it("許可IPの入力エラー境界 / 値オブジェクトの不正を400に変換する", () => {
  expect(() => inputValues(() => AllowedIpRange.create("invalid"))).toThrow(
    expect.objectContaining({ code: "BAD_REQUEST" }),
  );
});

it("許可IPの入力エラー境界 / 入力検証以外の障害は入力エラーに変換しない", () => {
  const failure = new Error("unexpected");
  expect(() =>
    inputValues(() => {
      throw failure;
    }),
  ).toThrow(failure);
});
