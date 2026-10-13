// コンパイル時だけの契約検査。本番コードからはインポートしない。
import { CustomerAccountEntity } from "#api/domain/access/entities/customer-account.ts";
import type { CustomerAccount } from "#api/domain/access/entities/customer-account.ts";
import { BusinessAccountEntity } from "#api/domain/access/entities/business-account.ts";
import type { BusinessAccount } from "#api/domain/access/entities/business-account.ts";
import { OperatorAccountEntity } from "#api/domain/access/entities/operator-account.ts";
import type { OperatorAccount } from "#api/domain/access/entities/operator-account.ts";
import type { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import type { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import type { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import type { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import type { BusinessAccountId } from "#api/domain/access/value-objects/business-account-id.ts";
import type { CustomerAccountId } from "#api/domain/access/value-objects/customer-account-id.ts";
import type { OperatorAccountId } from "#api/domain/access/value-objects/operator-account-id.ts";

type Assert<T extends true> = T;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Assignable<Source, Target> = [Source] extends [Target] ? true : false;

type CanCall<Receiver, Method> = Assignable<Receiver, ThisParameterType<Method>>;

export type ServiceAccountIdContracts = [
  Assert<Equal<Assignable<CustomerAccountId, BusinessAccountId>, false>>,
  Assert<Equal<Assignable<CustomerAccountId, OperatorAccountId>, false>>,
  Assert<Equal<Assignable<BusinessAccountId, CustomerAccountId>, false>>,
  Assert<Equal<Assignable<BusinessAccountId, OperatorAccountId>, false>>,
  Assert<Equal<Assignable<OperatorAccountId, CustomerAccountId>, false>>,
  Assert<Equal<Assignable<OperatorAccountId, BusinessAccountId>, false>>,
  Assert<Equal<Assignable<string, CustomerAccountId>, false>>,
  Assert<Equal<Assignable<string, BusinessAccountId>, false>>,
  Assert<Equal<Assignable<string, OperatorAccountId>, false>>,
  Assert<Equal<Assignable<string, AuthenticationSubjectId>, false>>,
  Assert<Equal<Assignable<AccessId, CustomerAccountId>, false>>,
  Assert<Equal<Assignable<AccessId, BusinessAccountId>, false>>,
  Assert<Equal<Assignable<AccessId, OperatorAccountId>, false>>,
  Assert<Equal<Assignable<CustomerAccountId, AccessId>, true>>,
  Assert<Equal<Assignable<BusinessAccountId, AccessId>, true>>,
  Assert<Equal<Assignable<OperatorAccountId, AccessId>, true>>,
  Assert<Equal<Assignable<AuthenticationSubjectId, CustomerAccountId>, false>>,
  Assert<Equal<Assignable<AuthenticationSubjectId, BusinessAccountId>, false>>,
  Assert<Equal<Assignable<AuthenticationSubjectId, OperatorAccountId>, false>>,
  Assert<Equal<Assignable<CustomerAccountId, AuthenticationSubjectId>, false>>,
  Assert<Equal<Assignable<BusinessAccountId, AuthenticationSubjectId>, false>>,
  Assert<Equal<Assignable<OperatorAccountId, AuthenticationSubjectId>, false>>,
];

export type CustomerAccountContracts = [
  Assert<Equal<ReturnType<typeof CustomerAccountEntity.register>, CustomerAccountEntity<"active">>>,
  Assert<Equal<ReturnType<typeof CustomerAccountEntity.restore>, CustomerAccount>>,
  Assert<Equal<ReturnType<CustomerAccount["withdraw"]>, CustomerAccountEntity<"withdrawn">>>,
  Assert<Equal<CanCall<CustomerAccountEntity<"active">, CustomerAccount["withdraw"]>, true>>,
  Assert<Equal<CanCall<CustomerAccountEntity<"withdrawn">, CustomerAccount["withdraw"]>, false>>,
  Assert<Equal<CanCall<CustomerAccount, CustomerAccount["withdraw"]>, false>>,
  Assert<Equal<CanCall<BusinessAccountEntity<"active">, CustomerAccount["withdraw"]>, false>>,
  Assert<Equal<CanCall<OperatorAccountEntity<"active">, CustomerAccount["withdraw"]>, false>>,
  Assert<Equal<Assignable<"stop", keyof CustomerAccount>, false>>,
  Assert<Equal<CustomerAccount["category"], "customer">>,
  Assert<Equal<Parameters<typeof CustomerAccountEntity.register>[0]["id"], CustomerAccountId>>,
  Assert<Equal<Parameters<typeof CustomerAccountEntity.restore>[0]["id"], CustomerAccountId>>,
  Assert<Equal<Parameters<typeof CustomerAccountEntity.register>[0]["email"], EmailAddress>>,
  Assert<Equal<Parameters<typeof CustomerAccountEntity.restore>[0]["email"], EmailAddress | null>>,
  Assert<Equal<Parameters<typeof CustomerAccountEntity.restore>[0]["name"], AccessName>>,
  Assert<
    Equal<Parameters<typeof CustomerAccountEntity.restore>[0]["subjectId"], AuthenticationSubjectId>
  >,
  Assert<
    Equal<
      Assignable<typeof CustomerAccountEntity, abstract new (...args: never[]) => unknown>,
      false
    >
  >,
];

export type BusinessAccountContracts = [
  Assert<Equal<ReturnType<typeof BusinessAccountEntity.register>, BusinessAccountEntity<"active">>>,
  Assert<Equal<ReturnType<typeof BusinessAccountEntity.restore>, BusinessAccount>>,
  Assert<Equal<ReturnType<BusinessAccount["withdraw"]>, BusinessAccountEntity<"withdrawn">>>,
  Assert<Equal<CanCall<BusinessAccountEntity<"active">, BusinessAccount["withdraw"]>, true>>,
  Assert<Equal<CanCall<BusinessAccountEntity<"withdrawn">, BusinessAccount["withdraw"]>, false>>,
  Assert<Equal<CanCall<BusinessAccount, BusinessAccount["withdraw"]>, false>>,
  Assert<Equal<CanCall<CustomerAccountEntity<"active">, BusinessAccount["withdraw"]>, false>>,
  Assert<Equal<CanCall<OperatorAccountEntity<"active">, BusinessAccount["withdraw"]>, false>>,
  Assert<Equal<Assignable<"stop", keyof BusinessAccount>, false>>,
  Assert<Equal<BusinessAccount["category"], "business">>,
  Assert<Equal<Parameters<typeof BusinessAccountEntity.register>[0]["id"], BusinessAccountId>>,
  Assert<Equal<Parameters<typeof BusinessAccountEntity.restore>[0]["id"], BusinessAccountId>>,
  Assert<Equal<Parameters<typeof BusinessAccountEntity.register>[0]["email"], EmailAddress>>,
  Assert<Equal<Parameters<typeof BusinessAccountEntity.restore>[0]["email"], EmailAddress | null>>,
  Assert<Equal<Parameters<typeof BusinessAccountEntity.restore>[0]["name"], AccessName>>,
  Assert<
    Equal<Parameters<typeof BusinessAccountEntity.restore>[0]["subjectId"], AuthenticationSubjectId>
  >,
  Assert<
    Equal<
      Assignable<typeof BusinessAccountEntity, abstract new (...args: never[]) => unknown>,
      false
    >
  >,
];

export type OperatorAccountContracts = [
  Assert<Equal<ReturnType<typeof OperatorAccountEntity.register>, OperatorAccountEntity<"active">>>,
  Assert<Equal<ReturnType<typeof OperatorAccountEntity.restore>, OperatorAccount>>,
  Assert<Equal<ReturnType<OperatorAccount["stop"]>, OperatorAccountEntity<"stopped">>>,
  Assert<Equal<CanCall<OperatorAccountEntity<"active">, OperatorAccount["stop"]>, true>>,
  Assert<Equal<CanCall<OperatorAccountEntity<"stopped">, OperatorAccount["stop"]>, false>>,
  Assert<Equal<CanCall<OperatorAccount, OperatorAccount["stop"]>, false>>,
  Assert<Equal<CanCall<CustomerAccountEntity<"active">, OperatorAccount["stop"]>, false>>,
  Assert<Equal<CanCall<BusinessAccountEntity<"active">, OperatorAccount["stop"]>, false>>,
  Assert<Equal<Assignable<"withdraw", keyof OperatorAccount>, false>>,
  Assert<Equal<OperatorAccount["category"], "operator">>,
  Assert<Equal<Parameters<typeof OperatorAccountEntity.register>[0]["id"], OperatorAccountId>>,
  Assert<Equal<Parameters<typeof OperatorAccountEntity.restore>[0]["id"], OperatorAccountId>>,
  Assert<Equal<Parameters<typeof OperatorAccountEntity.register>[0]["email"], EmailAddress>>,
  Assert<Equal<Parameters<typeof OperatorAccountEntity.restore>[0]["email"], EmailAddress | null>>,
  Assert<Equal<Parameters<typeof OperatorAccountEntity.restore>[0]["name"], AccessName>>,
  Assert<
    Equal<Parameters<typeof OperatorAccountEntity.restore>[0]["subjectId"], AuthenticationSubjectId>
  >,
  Assert<
    Equal<
      Assignable<typeof OperatorAccountEntity, abstract new (...args: never[]) => unknown>,
      false
    >
  >,
];

export function verifyServiceAccountNarrowing(
  customer: CustomerAccount,
  business: BusinessAccount,
  operator: OperatorAccount,
) {
  if (customer.status === "active") {
    const withdrawn: CustomerAccountEntity<"withdrawn"> = customer.withdraw();
    const id: CustomerAccountId = withdrawn.id;
    void id;
  }

  if (business.status === "active") {
    const withdrawn: BusinessAccountEntity<"withdrawn"> = business.withdraw();
    const id: BusinessAccountId = withdrawn.id;
    void id;
  }

  if (operator.status === "active") {
    const stopped: OperatorAccountEntity<"stopped"> = operator.stop();
    const id: OperatorAccountId = stopped.id;
    void id;
  }
}
