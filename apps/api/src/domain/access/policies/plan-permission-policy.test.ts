import { PlanDefinition } from "#api/domain/access/entities/plan-definition.ts";
import {
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  PERMISSION_CODES,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import { effectivePermissions } from "#api/domain/access/policies/plan-permission-policy.ts";
import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { PermissionValue } from "#api/domain/access/value-objects/permission.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";
import { invokeRuntime } from "#api/test/invoke-runtime.ts";
import { expect, it } from "vite-plus/test";

const customerPlanInput = {
  code: "customer-standard",
  name: "通常会員プラン",
  category: "customer",
  permissions: ["order:read", "order:create", "product.read"],
};
const customerPlan = PlanDefinition.create(customerPlanInput);
const businessPlan = PlanDefinition.create({
  code: "business-standard",
  name: "企業プラン",
  category: "business",
  permissions: ["member.read", "order:read", "product.read", "product.update"],
});

it("プラン定義（PlanDefinition） / 通常会員プランを検証済みの値で作成する", () => {
  expect(customerPlan).toBeInstanceOf(PlanDefinition);
  expect(customerPlan).toEqual({
    ...customerPlanInput,
    code: AccessId.create(customerPlanInput.code),
    name: AccessName.create(customerPlanInput.name),
  });
});

it("プラン定義（PlanDefinition） / 企業プランに企業サービスの全権限を設定できる", () => {
  const plan = PlanDefinition.create({
    ...businessPlan.toSnapshot(),
    permissions: BUSINESS_PERMISSIONS,
  });
  expect(plan.permissions).toEqual(BUSINESS_PERMISSIONS);
});

it("プラン定義（PlanDefinition） / コードと名称にAccessId・AccessNameと同じ正規化と上限を適用する", () => {
  const code = "c".repeat(ACCESS_LIMITS.idMaxLength);
  const name = "名".repeat(ACCESS_LIMITS.nameMaxLength);
  const plan = PlanDefinition.create({
    ...customerPlanInput,
    code: ` ${code} `,
    name: ` ${name} `,
  });
  expect(plan.code).toBe(code);
  expect(plan.name).toBe(name);
});

it("プラン定義（PlanDefinition） / レコード以外の入力を拒否する", () => {
  for (const value of [null, undefined, "plan", 1, true, []]) {
    expect(() => PlanDefinition.create(value)).toThrow(InvalidValueObjectError);
  }
});

it("プラン定義（PlanDefinition） / 未指定・未知・運営の対象サービスを拒否する", () => {
  for (const category of [undefined, null, "", "unknown", "operator", 1]) {
    expect(() => PlanDefinition.create({ ...customerPlanInput, category })).toThrow(
      InvalidValueObjectError,
    );
  }
});

it("プラン定義（PlanDefinition） / 未指定・空白・長すぎるコードを拒否する", () => {
  for (const code of [undefined, null, 1, "", " ", "c".repeat(ACCESS_LIMITS.idMaxLength + 1)]) {
    expect(() => PlanDefinition.create({ ...customerPlanInput, code })).toThrow(
      InvalidValueObjectError,
    );
  }
});

it("プラン定義（PlanDefinition） / 未指定・空白・長すぎる名称を拒否する", () => {
  for (const name of [undefined, null, 1, "", " ", "名".repeat(ACCESS_LIMITS.nameMaxLength + 1)]) {
    expect(() => PlanDefinition.create({ ...customerPlanInput, name })).toThrow(
      InvalidValueObjectError,
    );
  }
});

it("プラン定義（PlanDefinition） / 配列ではない権限一覧を拒否する", () => {
  for (const permissions of [undefined, null, "order:read", {}, 1]) {
    expect(() => PlanDefinition.create({ ...customerPlanInput, permissions })).toThrow(
      InvalidValueObjectError,
    );
  }
});

it("プラン定義（PlanDefinition） / 未知の権限・型違い・疎な配列を拒否する", () => {
  for (const permissions of [["unknown"], [null], [1], ["order:read", undefined], Array(1)]) {
    expect(() => PlanDefinition.create({ ...customerPlanInput, permissions })).toThrow(
      InvalidValueObjectError,
    );
  }
});

it("プラン定義（PlanDefinition） / 重複排除前に権限数の上限を検証する", () => {
  const permissions = Array.from(
    { length: ACCESS_LIMITS.permissionsMaxCount + 1 },
    () => "order:read",
  );
  expect(() => PlanDefinition.create({ ...customerPlanInput, permissions })).toThrow(
    InvalidValueObjectError,
  );
});

it("プラン定義（PlanDefinition） / 上限ちょうどの権限一覧を受け付け重複を除く", () => {
  const permissions = Array.from({ length: ACCESS_LIMITS.permissionsMaxCount }, () => "order:read");
  expect(PlanDefinition.create({ ...customerPlanInput, permissions }).permissions).toEqual([
    "order:read",
  ]);
});

it("プラン定義（PlanDefinition） / 対象サービス外の権限を拒否する", () => {
  for (const permission of ["product.update", "member.read", "organization.manage"]) {
    expect(() =>
      PlanDefinition.create({ ...customerPlanInput, permissions: [permission] }),
    ).toThrow(InvalidValueObjectError);
  }

  for (const permission of ["organization.read", "user.personal.read", "user.delete"]) {
    expect(() =>
      PlanDefinition.create({ ...businessPlan.toSnapshot(), permissions: [permission] }),
    ).toThrow(InvalidValueObjectError);
  }
});

it("プラン定義（PlanDefinition） / 権限のないプランを許容する", () => {
  expect(PlanDefinition.create({ ...customerPlanInput, permissions: [] }).permissions).toEqual([]);
});

it("プラン定義（PlanDefinition） / 初出順に重複を除き、入力と独立した定義と権限配列を凍結する", () => {
  const permissions = ["product.read", "order:read", "product.read"];
  const input = { ...customerPlanInput, permissions };
  const plan = PlanDefinition.create(input);
  expect(plan.permissions).toEqual(["product.read", "order:read"]);
  expect(plan.permissions).not.toBe(permissions);
  expect(Object.isFrozen(plan)).toBe(true);
  expect(Object.isFrozen(plan.permissions)).toBe(true);
  expect(Reflect.set(plan, "category", "business")).toBe(false);
  expect(Reflect.set(plan.permissions, "0", "order:create")).toBe(false);
  input.name = "変更後";
  permissions.push("order:create");
  expect(plan.name).toBe(customerPlanInput.name);
  expect(plan.permissions).toEqual(["product.read", "order:read"]);
});

it("有効な権限の算出（effectivePermissions） / 通常会員のロールとプランの一部だけ重なる権限を返す", () => {
  expect(
    effectivePermissions("customer", ["order:read", "order:update", "product.read"], customerPlan),
  ).toEqual(["order:read", "product.read"]);
});

it("有効な権限の算出（effectivePermissions） / 企業のロールとプランの一部だけ重なる権限を返す", () => {
  expect(
    effectivePermissions(
      "business",
      ["member.read", "member.invite", "product.update"],
      businessPlan,
    ),
  ).toEqual(["member.read", "product.update"]);
});

it("有効な権限の算出（effectivePermissions） / プランに含まれていてもロールにない権限を付与しない", () => {
  expect(effectivePermissions("customer", ["order:read"], customerPlan)).toEqual(["order:read"]);
  expect(effectivePermissions("business", ["member.read"], businessPlan)).toEqual(["member.read"]);
});

it("有効な権限の算出（effectivePermissions） / ロールに含まれていてもプランにない権限を付与しない", () => {
  expect(effectivePermissions("customer", CUSTOMER_PERMISSIONS, customerPlan)).toEqual(
    customerPlan.permissions,
  );
  expect(effectivePermissions("business", BUSINESS_PERMISSIONS, businessPlan)).toEqual(
    businessPlan.permissions,
  );
});

it("有効な権限の算出（effectivePermissions） / ロールが空ならプランから権限を付与しない", () => {
  expect(effectivePermissions("customer", [], customerPlan)).toEqual([]);
  expect(effectivePermissions("business", [], businessPlan)).toEqual([]);
});

it("有効な権限の算出（effectivePermissions） / プランが空ならロールから権限を付与しない", () => {
  const plan = PlanDefinition.create({ ...customerPlan.toSnapshot(), permissions: [] });
  expect(effectivePermissions("customer", CUSTOMER_PERMISSIONS, plan)).toEqual([]);
});

it("有効な権限の算出（effectivePermissions） / ロールとプランに共通の権限がなければ空になる", () => {
  expect(effectivePermissions("customer", ["order:update"], customerPlan)).toEqual([]);
  expect(effectivePermissions("business", ["member.invite"], businessPlan)).toEqual([]);
});

it.each(["customer", "business"] as const)(
  "有効な権限の算出（effectivePermissions） / %sで未割当・未知のプランが解決できなければ権限を付与しない",
  (category) => {
    expect(effectivePermissions(category, PERMISSION_CODES, null)).toEqual([]);
  },
);

it("有効な権限の算出（effectivePermissions） / 対象サービスとプランが一致しなければ共通権限も付与しない", () => {
  expect(effectivePermissions("customer", ["order:read"], businessPlan)).toEqual([]);
  expect(effectivePermissions("business", ["order:read"], customerPlan)).toEqual([]);
});

it("有効な権限の算出（effectivePermissions） / 通常会員のサービス上限をプランとロールの両方より優先する", () => {
  // 定義の作成を意図的に通さず、計算側も通常会員の上限を守ることを独立に検証する。
  const plan = {
    ...customerPlan.toSnapshot(),
    permissions: PERMISSION_CODES.map(PermissionValue.create),
  };
  expect(
    invokeRuntime({ effectivePermissions }, "effectivePermissions", [
      "customer",
      PERMISSION_CODES,
      plan,
    ]),
  ).toEqual(CUSTOMER_PERMISSIONS);
});

it("有効な権限の算出（effectivePermissions） / 企業のサービス上限をプランとロールの両方より優先する", () => {
  const plan = {
    ...businessPlan.toSnapshot(),
    permissions: PERMISSION_CODES.map(PermissionValue.create),
  };
  expect(
    invokeRuntime({ effectivePermissions }, "effectivePermissions", [
      "business",
      PERMISSION_CODES,
      plan,
    ]),
  ).toEqual(BUSINESS_PERMISSIONS);
});

it("有効な権限の算出（effectivePermissions） / 運営は商用プランの有無に関係なく運営ロールの権限だけを使う", () => {
  for (const plan of [null, customerPlan, businessPlan]) {
    expect(effectivePermissions("operator", ["organization.read", "audit.read"], plan)).toEqual([
      "organization.read",
      "audit.read",
    ]);
  }
});

it("有効な権限の算出（effectivePermissions） / 運営でも全権限バイパスはなく運営のサービス上限を守る", () => {
  expect(effectivePermissions("operator", PERMISSION_CODES, null)).toEqual(PLATFORM_PERMISSIONS);
  expect(effectivePermissions("operator", [], businessPlan)).toEqual([]);
  expect(effectivePermissions("operator", ["product.update", "order:create"], null)).toEqual([]);
});

it("有効な権限の算出（effectivePermissions） / 未知のサービスはJavaScript境界から呼ばれても権限を付与しない", () => {
  expect(
    invokeRuntime({ effectivePermissions }, "effectivePermissions", [
      "unknown",
      PERMISSION_CODES,
      customerPlan,
    ]),
  ).toEqual([]);
});

it("有効な権限の算出（effectivePermissions） / 結果は初出順に重複を除いて凍結し、入力を変更しない", () => {
  const rolePermissions: PermissionCode[] = ["product.read", "order:read", "product.read"];
  const result = effectivePermissions("customer", rolePermissions, customerPlan);
  expect(result).toEqual(["product.read", "order:read"]);
  expect(rolePermissions).toEqual(["product.read", "order:read", "product.read"]);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Reflect.set(result, "0", "order:create")).toBe(false);
  expect(Object.isFrozen(effectivePermissions("customer", rolePermissions, null))).toBe(true);
  const operator = effectivePermissions("operator", ["audit.read", "audit.read"], null);
  expect(operator).toEqual(["audit.read"]);
  expect(Object.isFrozen(operator)).toBe(true);
});
