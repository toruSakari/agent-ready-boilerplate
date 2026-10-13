// コンパイル時だけの契約検査。本番コードからはインポートしない。
import type { BusinessAccountUseCases } from "#api/application/access/use-cases/business-account-use-cases.ts";
import type { CustomerAccountUseCases } from "#api/application/access/use-cases/customer-account-use-cases.ts";
import type { OperatorAccountUseCases } from "#api/application/access/use-cases/operator-account-use-cases.ts";
import type { BusinessAccountEntity } from "#api/domain/access/entities/business-account.ts";
import type { CustomerAccountEntity } from "#api/domain/access/entities/customer-account.ts";
import type { OperatorAccountEntity } from "#api/domain/access/entities/operator-account.ts";
import type { AccessChange } from "#api/domain/access/repositories/access-repository.ts";

type Assert<T extends true> = T;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Assignable<Source, Target> = [Source] extends [Target] ? true : false;

type CustomerEnrollment = NonNullable<AccessChange["customerAccounts"]>[number];

type BusinessEnrollment = NonNullable<AccessChange["businessAccounts"]>[number];

type OperatorEnrollment = NonNullable<AccessChange["operatorAccounts"]>[number];

export type ServiceEnrollmentChangeContracts = [
  Assert<Equal<CustomerEnrollment, CustomerAccountEntity<"active">>>,
  Assert<Equal<BusinessEnrollment, BusinessAccountEntity<"active">>>,
  Assert<Equal<OperatorEnrollment, OperatorAccountEntity<"active">>>,
  Assert<Equal<Assignable<CustomerAccountEntity<"active">, BusinessEnrollment>, false>>,
  Assert<Equal<Assignable<CustomerAccountEntity<"active">, OperatorEnrollment>, false>>,
  Assert<Equal<Assignable<BusinessAccountEntity<"active">, CustomerEnrollment>, false>>,
  Assert<Equal<Assignable<BusinessAccountEntity<"active">, OperatorEnrollment>, false>>,
  Assert<Equal<Assignable<OperatorAccountEntity<"active">, CustomerEnrollment>, false>>,
  Assert<Equal<Assignable<OperatorAccountEntity<"active">, BusinessEnrollment>, false>>,
  Assert<Equal<Assignable<CustomerAccountEntity<"withdrawn">, CustomerEnrollment>, false>>,
  Assert<Equal<Assignable<BusinessAccountEntity<"withdrawn">, BusinessEnrollment>, false>>,
  Assert<Equal<Assignable<OperatorAccountEntity<"stopped">, OperatorEnrollment>, false>>,
];

export type ServiceClosureChangeContracts = [
  Assert<
    Equal<NonNullable<AccessChange["withdrawnCustomerAccount"]>, CustomerAccountEntity<"withdrawn">>
  >,
  Assert<
    Equal<NonNullable<AccessChange["withdrawnBusinessAccount"]>, BusinessAccountEntity<"withdrawn">>
  >,
  Assert<
    Equal<NonNullable<AccessChange["stoppedOperatorAccount"]>, OperatorAccountEntity<"stopped">>
  >,
  Assert<
    Equal<
      Assignable<CustomerAccountEntity<"active">, AccessChange["withdrawnCustomerAccount"]>,
      false
    >
  >,
  Assert<
    Equal<
      Assignable<BusinessAccountEntity<"active">, AccessChange["withdrawnBusinessAccount"]>,
      false
    >
  >,
  Assert<
    Equal<
      Assignable<OperatorAccountEntity<"active">, AccessChange["stoppedOperatorAccount"]>,
      false
    >
  >,
  Assert<
    Equal<
      Assignable<CustomerAccountEntity<"withdrawn">, AccessChange["withdrawnBusinessAccount"]>,
      false
    >
  >,
  Assert<
    Equal<
      Assignable<BusinessAccountEntity<"withdrawn">, AccessChange["withdrawnCustomerAccount"]>,
      false
    >
  >,
  Assert<
    Equal<
      Assignable<CustomerAccountEntity<"withdrawn">, AccessChange["stoppedOperatorAccount"]>,
      false
    >
  >,
  Assert<
    Equal<
      Assignable<OperatorAccountEntity<"stopped">, AccessChange["withdrawnCustomerAccount"]>,
      false
    >
  >,
];

export type ServiceUseCaseContracts = [
  Assert<Equal<Parameters<CustomerAccountUseCases["removeByOperator"]>[0]["accountId"], string>>,
  Assert<Equal<Parameters<BusinessAccountUseCases["removeByOperator"]>[0]["accountId"], string>>,
  Assert<Equal<Parameters<OperatorAccountUseCases["removeByOperator"]>[0]["accountId"], string>>,
  Assert<Equal<Assignable<"register", keyof BusinessAccountUseCases>, false>>,
  Assert<Equal<Assignable<"register", keyof OperatorAccountUseCases>, false>>,
  Assert<Equal<Assignable<"withdraw", keyof OperatorAccountUseCases>, false>>,
  Assert<Equal<Assignable<"stop", keyof CustomerAccountUseCases>, false>>,
  Assert<Equal<Assignable<"stop", keyof BusinessAccountUseCases>, false>>,
];
