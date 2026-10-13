// コンパイル時だけの契約検査。本番コードからはインポートしない。
import type {
  AccessChange,
  AccessRecords,
} from "#api/domain/access/repositories/access-repository.ts";
import type {
  CustomerAccount,
  CustomerAccountEntity,
} from "#api/domain/access/entities/customer-account.ts";
import type {
  BusinessAccount,
  BusinessAccountEntity,
} from "#api/domain/access/entities/business-account.ts";
import type {
  OperatorAccount,
  OperatorAccountEntity,
} from "#api/domain/access/entities/operator-account.ts";

type Assert<T extends true> = T;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Assignable<Source, Target> = [Source] extends [Target] ? true : false;

export type ServiceAccountRepositoryContracts = [
  Assert<Equal<AccessRecords["customerAccounts"][number], CustomerAccount>>,
  Assert<Equal<AccessRecords["businessAccounts"][number], BusinessAccount>>,
  Assert<Equal<AccessRecords["operatorAccounts"][number], OperatorAccount>>,
  Assert<
    Equal<NonNullable<AccessChange["customerAccounts"]>[number], CustomerAccountEntity<"active">>
  >,
  Assert<
    Equal<NonNullable<AccessChange["businessAccounts"]>[number], BusinessAccountEntity<"active">>
  >,
  Assert<
    Equal<NonNullable<AccessChange["operatorAccounts"]>[number], OperatorAccountEntity<"active">>
  >,
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
      Assignable<readonly BusinessAccountEntity<"active">[], AccessChange["customerAccounts"]>,
      false
    >
  >,
  Assert<
    Equal<
      Assignable<readonly OperatorAccountEntity<"active">[], AccessChange["businessAccounts"]>,
      false
    >
  >,
  Assert<
    Equal<
      Assignable<readonly CustomerAccountEntity<"active">[], AccessChange["operatorAccounts"]>,
      false
    >
  >,
  Assert<
    Equal<
      Assignable<readonly CustomerAccountEntity<"withdrawn">[], AccessChange["customerAccounts"]>,
      false
    >
  >,
  Assert<
    Equal<
      Assignable<readonly BusinessAccountEntity<"withdrawn">[], AccessChange["businessAccounts"]>,
      false
    >
  >,
  Assert<
    Equal<
      Assignable<readonly OperatorAccountEntity<"stopped">[], AccessChange["operatorAccounts"]>,
      false
    >
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
];
