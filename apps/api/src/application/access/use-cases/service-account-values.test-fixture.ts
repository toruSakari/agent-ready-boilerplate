import type { Identity } from "#api/application/auth/contracts/identity.ts";
import { BusinessAccountEntity } from "#api/domain/access/entities/business-account.ts";
import { CustomerAccountEntity } from "#api/domain/access/entities/customer-account.ts";
import { OperatorAccountEntity } from "#api/domain/access/entities/operator-account.ts";
import { PLATFORM_PERMISSIONS } from "#api/domain/access/policies/permission-catalog.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import { BusinessAccountId } from "#api/domain/access/value-objects/business-account-id.ts";
import { CustomerAccountId } from "#api/domain/access/value-objects/customer-account-id.ts";
import { OperatorAccountId } from "#api/domain/access/value-objects/operator-account-id.ts";

export const SUBJECT = AuthenticationSubjectId.create("clerk:shared-subject");

export const EMAIL = EmailAddress.create("shared@example.com");

export const ORGANIZATION = AccessId.create("organization-a");

export const PLATFORM = AccessId.create(PLATFORM_SCOPE);

export const INVITATION_TOKEN = "valid-service-invitation";

export const customer = CustomerAccountEntity.register({
  id: CustomerAccountId.create("customer:shared"),
  subjectId: SUBJECT,
  name: AccessName.create("通常会員"),
  email: EMAIL,
});

export const business = BusinessAccountEntity.register({
  id: BusinessAccountId.create("business:shared"),
  subjectId: SUBJECT,
  name: AccessName.create("企業担当者"),
  email: EMAIL,
});

export const operator = OperatorAccountEntity.register({
  id: OperatorAccountId.create("operator:shared"),
  subjectId: SUBJECT,
  name: AccessName.create("運営担当者"),
  email: EMAIL,
});

export const operatorIdentity: Identity = {
  userId: "operator:administrator",
  subjectId: "clerk:administrator",
  tenantId: PLATFORM_SCOPE,
  channel: "admin",
  role: "admin",
  email: "administrator@example.com",
  permissions: PLATFORM_PERMISSIONS,
};

export function identity(channel: Identity["channel"], userId = "unregistered"): Identity {
  return {
    userId,
    subjectId: SUBJECT,
    tenantId: channel === "admin" ? PLATFORM_SCOPE : ORGANIZATION,
    channel,
    role: "member",
    email: EMAIL,
    permissions: [],
  };
}
