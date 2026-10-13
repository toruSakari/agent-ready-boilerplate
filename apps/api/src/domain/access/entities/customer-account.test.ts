import { CustomerAccountEntity } from "#api/domain/access/entities/customer-account.ts";
import { InvalidCustomerAccountError } from "#api/domain/access/errors/invalid-customer-account-error.ts";
import { InvalidCustomerAccountTransitionError } from "#api/domain/access/errors/invalid-customer-account-transition-error.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import { CustomerAccountId } from "#api/domain/access/value-objects/customer-account-id.ts";
import { invokeRuntime } from "#api/test/invoke-runtime.ts";
import { expect, it } from "vite-plus/test";

const registration = {
  id: CustomerAccountId.create("customer:existing-user"),
  name: AccessName.create("通常会員"),
  email: EmailAddress.create("customer@example.com"),
  subjectId: AuthenticationSubjectId.create("shared-clerk-subject"),
};
const anonymousName = AccessName.create("削除済みユーザー");

it("通常会員エンティティ（CustomerAccountEntity） / 通常会員を有効な状態で登録し凍結する", () => {
  const account = CustomerAccountEntity.register(registration);
  expect(account).toMatchObject({ ...registration, category: "customer", status: "active" });
  expect(account.deleted).toBe(false);
  expect(Object.isFrozen(account)).toBe(true);
  expect(Reflect.set(account, "status", "withdrawn")).toBe(false);
});

it("通常会員エンティティ（CustomerAccountEntity） / 元の会員を変更せず退会し、履歴用の会員IDと認証主体IDを保持する", () => {
  const active = CustomerAccountEntity.register(registration);
  const withdrawn = active.withdraw();
  expect(withdrawn).not.toBe(active);
  expect(withdrawn).toMatchObject({
    ...registration,
    name: anonymousName,
    email: null,
    category: "customer",
    status: "withdrawn",
  });
  expect(withdrawn.deleted).toBe(true);
  expect(Object.isFrozen(withdrawn)).toBe(true);
  expect(Reflect.set(withdrawn, "email", registration.email)).toBe(false);
  expect(active).toMatchObject({ ...registration, status: "active" });
  expect(active.deleted).toBe(false);
});

it("通常会員エンティティ（CustomerAccountEntity） / 復元した有効な会員の状態を絞って退会できる", () => {
  const account = CustomerAccountEntity.restore({ ...registration, status: "active" });
  if (account.status !== "active") {
    throw new Error("想定と異なる状態です");
  }

  expect(account.withdraw().status).toBe("withdrawn");
  expect(Object.isFrozen(account)).toBe(true);
});

it("通常会員エンティティ（CustomerAccountEntity） / 退会済み会員を復元し、JavaScript境界からの再退会も拒否する", () => {
  const account = CustomerAccountEntity.restore({
    ...registration,
    name: anonymousName,
    email: null,
    status: "withdrawn",
  });
  expect(account.deleted).toBe(true);
  expect(account.subjectId).toBe(registration.subjectId);
  expect(Object.isFrozen(account)).toBe(true);
  expect(() => invokeRuntime(account, "withdraw")).toThrow(InvalidCustomerAccountTransitionError);
  expect(() =>
    invokeRuntime(CustomerAccountEntity.register(registration).withdraw(), "withdraw"),
  ).toThrow(InvalidCustomerAccountTransitionError);
});

it("通常会員エンティティ（CustomerAccountEntity） / 既存のメール未設定会員は復元できるが、新規登録にはメールが必要", () => {
  const account = CustomerAccountEntity.restore({
    ...registration,
    email: null,
    status: "active",
  });
  expect(account.email).toBeNull();
  expect(account.deleted).toBe(false);
  if (account.status !== "active") {
    throw new Error("想定と異なる状態です");
  }

  expect(account.withdraw().status).toBe("withdrawn");
  expect(() =>
    invokeRuntime(CustomerAccountEntity, "register", [{ ...registration, email: null }]),
  ).toThrow(InvalidCustomerAccountError);
});

it.each([
  { name: registration.name, email: null },
  { name: anonymousName, email: registration.email },
  { name: registration.name, email: registration.email },
])(
  "通常会員エンティティ（CustomerAccountEntity） / 既存の退会済み会員の保存値を変更せず復元する: %s",
  (personalData) => {
    const account = CustomerAccountEntity.restore({
      ...registration,
      ...personalData,
      status: "withdrawn",
    });
    expect(account).toMatchObject({ ...registration, ...personalData, status: "withdrawn" });
    expect(account.deleted).toBe(true);
    expect(() => invokeRuntime(account, "withdraw")).toThrow(InvalidCustomerAccountTransitionError);
  },
);

it.each(["stopped", "deleted", ""])(
  "通常会員エンティティ（CustomerAccountEntity） / 状態 %s をJavaScript境界でも拒否する",
  (status) => {
    expect(() =>
      invokeRuntime(CustomerAccountEntity, "restore", [{ ...registration, status }]),
    ).toThrow(InvalidCustomerAccountError);
  },
);
