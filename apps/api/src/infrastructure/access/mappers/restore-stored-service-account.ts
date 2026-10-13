import { z } from "zod";
import { CustomerAccountEntity } from "#api/domain/access/entities/customer-account.ts";
import type { CustomerAccount } from "#api/domain/access/entities/customer-account.ts";
import { BusinessAccountEntity } from "#api/domain/access/entities/business-account.ts";
import type { BusinessAccount } from "#api/domain/access/entities/business-account.ts";
import { OperatorAccountEntity } from "#api/domain/access/entities/operator-account.ts";
import type { OperatorAccount } from "#api/domain/access/entities/operator-account.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import { CustomerAccountId } from "#api/domain/access/value-objects/customer-account-id.ts";
import { BusinessAccountId } from "#api/domain/access/value-objects/business-account-id.ts";
import { OperatorAccountId } from "#api/domain/access/value-objects/operator-account-id.ts";

const accountRow = z.object({
  id: z.unknown(),
  name: z.unknown(),
  email: z.string().nullable(),
  deleted: z.union([z.literal(0), z.literal(1)]),
  subject_id: z.unknown(),
  category: z.enum(["customer", "business", "operator"]),
});

/** 保存行の種別とIDを検証して復元する。退会と運営停止は同じdeleted列でも別の終状態へ戻す。 */
export function restoreStoredServiceAccount(
  value: unknown,
): CustomerAccount | BusinessAccount | OperatorAccount {
  const row = accountRow.parse(value);
  const identity = {
    name: AccessName.create(row.name),
    email: row.email === null ? null : EmailAddress.create(row.email),
    subjectId: AuthenticationSubjectId.create(row.subject_id),
  };
  switch (row.category) {
    case "customer":
      return CustomerAccountEntity.restore({
        ...identity,
        id: CustomerAccountId.create(row.id),
        status: row.deleted === 1 ? "withdrawn" : "active",
      });
    case "business":
      return BusinessAccountEntity.restore({
        ...identity,
        id: BusinessAccountId.create(row.id),
        status: row.deleted === 1 ? "withdrawn" : "active",
      });
    case "operator":
      return OperatorAccountEntity.restore({
        ...identity,
        id: OperatorAccountId.create(row.id),
        status: row.deleted === 1 ? "stopped" : "active",
      });
  }
}
