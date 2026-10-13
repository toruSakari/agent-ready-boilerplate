import { describe, expect, it } from "vite-plus/test";
import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import { BusinessAccountId } from "#api/domain/access/value-objects/business-account-id.ts";
import { CustomerAccountId } from "#api/domain/access/value-objects/customer-account-id.ts";
import { OperatorAccountId } from "#api/domain/access/value-objects/operator-account-id.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";

const serviceIds = [
  { prefix: "customer:", create: CustomerAccountId.create },
  { prefix: "business:", create: BusinessAccountId.create },
  { prefix: "operator:", create: OperatorAccountId.create },
];

describe.each(serviceIds)("$prefix の会員ID", (props) => {
  it.each(["a", "old-shared-account", "demo-user", "a51663d3-380c-4ffa-bd2f-6f73a805d003"])(
    "UUIDに限定せず既存の接尾辞 %s を保持する",
    (suffix) => {
      const id = `${props.prefix}${suffix}`;
      expect(props.create(id)).toBe(id);
      expect(typeof props.create(id)).toBe("string");
    },
  );

  it("AccessIdと同じ最大長と前後の空白処理を適用する", () => {
    const maximumId = props.prefix + "x".repeat(ACCESS_LIMITS.idMaxLength - props.prefix.length);
    expect(props.create(maximumId)).toBe(AccessId.create(maximumId));
    expect(props.create(` ${props.prefix}old `)).toBe(AccessId.create(` ${props.prefix}old `));
    expect(() => props.create(`${maximumId}x`)).toThrow(InvalidValueObjectError);
  });

  it.each([null, undefined, 1, {}, "", " ", "account-without-prefix"])(
    "不正なID %s を拒否する",
    (value) => {
      expect(() => props.create(value)).toThrow(InvalidValueObjectError);
    },
  );

  it("接頭辞だけ・空白だけの接尾辞・他サービスのIDを拒否する", () => {
    expect(() => props.create(props.prefix)).toThrow(InvalidValueObjectError);
    expect(() => props.create(`${props.prefix} \t`)).toThrow(InvalidValueObjectError);
    for (const other of serviceIds) {
      if (other.prefix !== props.prefix) {
        expect(() => props.create(`${other.prefix}same-subject`)).toThrow(InvalidValueObjectError);
      }
    }
  });
});

describe("認証主体ID（AuthenticationSubjectId）", () => {
  it("本人確認IDを会員IDの形式に限定せず保持する", () => {
    expect(AuthenticationSubjectId.create("user_shared-clerk-subject")).toBe(
      "user_shared-clerk-subject",
    );
    expect(AuthenticationSubjectId.create("a")).toBe("a");
    expect(AuthenticationSubjectId.create(" a ")).toBe(" a ");
    const maximumSubject = "s".repeat(ACCESS_LIMITS.idMaxLength);
    expect(AuthenticationSubjectId.create(maximumSubject)).toBe(maximumSubject);
    const opaqueSubject = "s".repeat(ACCESS_LIMITS.idMaxLength + 1);
    expect(AuthenticationSubjectId.create(opaqueSubject)).toBe(opaqueSubject);
  });

  it.each([null, undefined, 1, {}, "", " \t"])("不正な本人確認ID %s を拒否する", (value) => {
    expect(() => AuthenticationSubjectId.create(value)).toThrow(InvalidValueObjectError);
  });
});
