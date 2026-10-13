import { BusinessAccountEntity } from "#api/domain/access/entities/business-account.ts";
import { InvalidBusinessAccountError } from "#api/domain/access/errors/invalid-business-account-error.ts";
import { InvalidBusinessAccountTransitionError } from "#api/domain/access/errors/invalid-business-account-transition-error.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import { BusinessAccountId } from "#api/domain/access/value-objects/business-account-id.ts";
import { invokeRuntime } from "#api/test/invoke-runtime.ts";
import { expect, it } from "vite-plus/test";

const registration = {
  id: BusinessAccountId.create("business:existing-user"),
  name: AccessName.create("企業担当者"),
  email: EmailAddress.create("business@example.com"),
  subjectId: AuthenticationSubjectId.create("shared-clerk-subject"),
};
const anonymousName = AccessName.create("削除済みユーザー");

it("企業担当者エンティティ（BusinessAccountEntity） / 企業担当者を有効な状態で登録し凍結する", () => {
  const account = BusinessAccountEntity.register(registration);
  expect(account).toMatchObject({ ...registration, category: "business", status: "active" });
  expect(account.deleted).toBe(false);
  expect(Object.isFrozen(account)).toBe(true);
  expect(Reflect.set(account, "status", "withdrawn")).toBe(false);
});

it("企業担当者エンティティ（BusinessAccountEntity） / 元の担当者を変更せず退会し、履歴用の会員IDと認証主体IDを保持する", () => {
  const active = BusinessAccountEntity.register(registration);
  const withdrawn = active.withdraw();
  expect(withdrawn).not.toBe(active);
  expect(withdrawn).toMatchObject({
    ...registration,
    name: anonymousName,
    email: null,
    category: "business",
    status: "withdrawn",
  });
  expect(withdrawn.deleted).toBe(true);
  expect(Object.isFrozen(withdrawn)).toBe(true);
  expect(Reflect.set(withdrawn, "email", registration.email)).toBe(false);
  expect(active).toMatchObject({ ...registration, status: "active" });
  expect(active.deleted).toBe(false);
});

it("企業担当者エンティティ（BusinessAccountEntity） / 復元した有効な担当者の状態を絞って退会できる", () => {
  const account = BusinessAccountEntity.restore({ ...registration, status: "active" });
  if (account.status !== "active") {
    throw new Error("想定と異なる状態です");
  }

  expect(account.withdraw().status).toBe("withdrawn");
  expect(Object.isFrozen(account)).toBe(true);
});

it("企業担当者エンティティ（BusinessAccountEntity） / 退会済み担当者を復元し、JavaScript境界からの再退会も拒否する", () => {
  const account = BusinessAccountEntity.restore({
    ...registration,
    name: anonymousName,
    email: null,
    status: "withdrawn",
  });
  expect(account.deleted).toBe(true);
  expect(account.subjectId).toBe(registration.subjectId);
  expect(Object.isFrozen(account)).toBe(true);
  expect(() => invokeRuntime(account, "withdraw")).toThrow(InvalidBusinessAccountTransitionError);
  expect(() =>
    invokeRuntime(BusinessAccountEntity.register(registration).withdraw(), "withdraw"),
  ).toThrow(InvalidBusinessAccountTransitionError);
});

it("企業担当者エンティティ（BusinessAccountEntity） / 既存のメール未設定担当者は復元できるが、新規登録にはメールが必要", () => {
  const account = BusinessAccountEntity.restore({
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
    invokeRuntime(BusinessAccountEntity, "register", [{ ...registration, email: null }]),
  ).toThrow(InvalidBusinessAccountError);
});

it.each([
  { name: registration.name, email: null },
  { name: anonymousName, email: registration.email },
  { name: registration.name, email: registration.email },
])(
  "企業担当者エンティティ（BusinessAccountEntity） / 既存の退会済み担当者の保存値を変更せず復元する: %s",
  (personalData) => {
    const account = BusinessAccountEntity.restore({
      ...registration,
      ...personalData,
      status: "withdrawn",
    });
    expect(account).toMatchObject({ ...registration, ...personalData, status: "withdrawn" });
    expect(account.deleted).toBe(true);
    expect(() => invokeRuntime(account, "withdraw")).toThrow(InvalidBusinessAccountTransitionError);
  },
);

it.each(["stopped", "deleted", ""])(
  "企業担当者エンティティ（BusinessAccountEntity） / 状態 %s をJavaScript境界でも拒否する",
  (status) => {
    expect(() =>
      invokeRuntime(BusinessAccountEntity, "restore", [{ ...registration, status }]),
    ).toThrow(InvalidBusinessAccountError);
  },
);
