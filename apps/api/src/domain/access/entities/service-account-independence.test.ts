import { expect, it } from "vite-plus/test";
import { CustomerAccountEntity } from "#api/domain/access/entities/customer-account.ts";
import { BusinessAccountEntity } from "#api/domain/access/entities/business-account.ts";
import { OperatorAccountEntity } from "#api/domain/access/entities/operator-account.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import { CustomerAccountId } from "#api/domain/access/value-objects/customer-account-id.ts";
import { BusinessAccountId } from "#api/domain/access/value-objects/business-account-id.ts";
import { OperatorAccountId } from "#api/domain/access/value-objects/operator-account-id.ts";

it("同じ本人確認IDと連絡先でもサービスごとの退会・停止を独立させる", () => {
  const contact = {
    name: AccessName.create("共有の本人"),
    email: EmailAddress.create("shared@example.com"),
    subjectId: AuthenticationSubjectId.create(" shared-opaque-subject "),
  };
  const customer = CustomerAccountEntity.register({
    ...contact,
    id: CustomerAccountId.create("customer:shared-user"),
  });
  const business = BusinessAccountEntity.register({
    ...contact,
    id: BusinessAccountId.create("business:shared-user"),
  });
  const operator = OperatorAccountEntity.register({
    ...contact,
    id: OperatorAccountId.create("operator:shared-user"),
  });

  const withdrawnCustomer = customer.withdraw();
  const withdrawnBusiness = business.withdraw();
  const stoppedOperator = operator.stop();

  for (const active of [customer, business, operator]) {
    expect(active).toMatchObject({ ...contact, status: "active" });
    expect(active.deleted).toBe(false);
  }

  for (const inactive of [withdrawnCustomer, withdrawnBusiness, stoppedOperator]) {
    expect(inactive.name).toBe("削除済みユーザー");
    expect(inactive.email).toBeNull();
    expect(inactive.subjectId).toBe(" shared-opaque-subject ");
    expect(inactive.deleted).toBe(true);
  }

  expect(withdrawnCustomer.id).toBe(customer.id);
  expect(withdrawnBusiness.id).toBe(business.id);
  expect(stoppedOperator.id).toBe(operator.id);
});
