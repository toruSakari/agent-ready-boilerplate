import { InvalidOperatorAccountError } from "#api/domain/access/errors/invalid-operator-account-error.ts";
import { InvalidOperatorAccountTransitionError } from "#api/domain/access/errors/invalid-operator-account-transition-error.ts";
import { OperatorAccountEntity } from "#api/domain/access/entities/operator-account.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import { OperatorAccountId } from "#api/domain/access/value-objects/operator-account-id.ts";
import { invokeRuntime } from "#api/test/invoke-runtime.ts";
import { expect, it } from "vite-plus/test";

const registration = {
  id: OperatorAccountId.create("operator:existing-user"),
  name: AccessName.create("運営担当者"),
  email: EmailAddress.create("operator@example.com"),
  subjectId: AuthenticationSubjectId.create("shared-clerk-subject"),
};
const anonymousName = AccessName.create("削除済みユーザー");

it("運営会員エンティティ（OperatorAccountEntity） / 運営アカウントを有効な状態で登録し凍結する", () => {
  const account = OperatorAccountEntity.register(registration);
  expect(account).toMatchObject({ ...registration, category: "operator", status: "active" });
  expect(account.deleted).toBe(false);
  expect(Object.isFrozen(account)).toBe(true);
  expect(Reflect.set(account, "status", "stopped")).toBe(false);
});

it("運営会員エンティティ（OperatorAccountEntity） / 元のアカウントを変更せず停止し、履歴用の会員IDと認証主体IDを保持する", () => {
  const active = OperatorAccountEntity.register(registration);
  const stopped = active.stop();
  expect(stopped).not.toBe(active);
  expect(stopped).toMatchObject({
    ...registration,
    name: anonymousName,
    email: null,
    category: "operator",
    status: "stopped",
  });
  expect(stopped.deleted).toBe(true);
  expect(Object.isFrozen(stopped)).toBe(true);
  expect(Reflect.set(stopped, "email", registration.email)).toBe(false);
  expect(active).toMatchObject({ ...registration, status: "active" });
  expect(active.deleted).toBe(false);
});

it("運営会員エンティティ（OperatorAccountEntity） / 復元した有効なアカウントの状態を絞って停止できる", () => {
  const account = OperatorAccountEntity.restore({ ...registration, status: "active" });
  if (account.status !== "active") {
    throw new Error("想定と異なる状態です");
  }

  expect(account.stop().status).toBe("stopped");
  expect(Object.isFrozen(account)).toBe(true);
});

it("運営会員エンティティ（OperatorAccountEntity） / 停止済みアカウントを復元し、JavaScript境界からの再停止も拒否する", () => {
  const account = OperatorAccountEntity.restore({
    ...registration,
    name: anonymousName,
    email: null,
    status: "stopped",
  });
  expect(account.deleted).toBe(true);
  expect(account.subjectId).toBe(registration.subjectId);
  expect(Object.isFrozen(account)).toBe(true);
  expect(() => invokeRuntime(account, "stop")).toThrow(InvalidOperatorAccountTransitionError);
  expect(() => invokeRuntime(OperatorAccountEntity.register(registration).stop(), "stop")).toThrow(
    InvalidOperatorAccountTransitionError,
  );
});

it("運営会員エンティティ（OperatorAccountEntity） / 既存のメール未設定アカウントは復元できるが、新規登録にはメールが必要", () => {
  const account = OperatorAccountEntity.restore({
    ...registration,
    email: null,
    status: "active",
  });
  expect(account.email).toBeNull();
  expect(account.deleted).toBe(false);
  if (account.status !== "active") {
    throw new Error("想定と異なる状態です");
  }

  expect(account.stop().status).toBe("stopped");
  expect(() =>
    invokeRuntime(OperatorAccountEntity, "register", [{ ...registration, email: null }]),
  ).toThrow(InvalidOperatorAccountError);
});

it.each([
  { name: registration.name, email: null },
  { name: anonymousName, email: registration.email },
  { name: registration.name, email: registration.email },
])(
  "運営会員エンティティ（OperatorAccountEntity） / 既存の停止済みアカウントの保存値を変更せず復元する: %s",
  (personalData) => {
    const account = OperatorAccountEntity.restore({
      ...registration,
      ...personalData,
      status: "stopped",
    });
    expect(account).toMatchObject({ ...registration, ...personalData, status: "stopped" });
    expect(account.deleted).toBe(true);
    expect(() => invokeRuntime(account, "stop")).toThrow(InvalidOperatorAccountTransitionError);
  },
);

it.each(["withdrawn", "deleted", ""])(
  "運営会員エンティティ（OperatorAccountEntity） / 状態 %s をJavaScript境界でも拒否する",
  (status) => {
    expect(() =>
      invokeRuntime(OperatorAccountEntity, "restore", [{ ...registration, status }]),
    ).toThrow(InvalidOperatorAccountError);
  },
);
