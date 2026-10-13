import type { AccessQuery } from "#api/application/access/queries/access-query.ts";
import { OrganizationEntity } from "#api/domain/access/entities/organization.ts";
import {
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import type {
  AccessRecords,
  AccessRepository,
} from "#api/domain/access/repositories/access-repository.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { vi } from "vite-plus/test";
import {
  business,
  customer,
  operator,
  operatorIdentity,
  ORGANIZATION,
} from "#api/application/access/use-cases/service-account-values.test-fixture.ts";

export function accessRecords(records: Partial<AccessRecords>): AccessRecords {
  return {
    version: 7,
    organizations: [new OrganizationEntity(ORGANIZATION, AccessName.create("企業A"), true, true)],
    customerAccounts: [customer],
    businessAccounts: [business],
    operatorAccounts: [operator],
    roles: [],
    memberships: [],
    invitations: [],
    ...records,
  };
}

export function accessRepository(state: AccessRecords) {
  return {
    load: vi.fn<AccessRepository["load"]>().mockResolvedValue(state),
    findInvitation: vi.fn<AccessRepository["findInvitation"]>(
      async (hash) => state.invitations.find((invitation) => invitation.tokenHash === hash) ?? null,
    ),
    commit: vi.fn<AccessRepository["commit"]>().mockResolvedValue(true),
  } satisfies AccessRepository;
}

export function accessQuery(state: AccessRecords) {
  return {
    plans: vi.fn<AccessQuery["plans"]>().mockReturnValue([]),
    plan: vi.fn<AccessQuery["plan"]>().mockResolvedValue({ code: null, permissions: [] }),
    resolveAccount: vi.fn<AccessQuery["resolveAccount"]>(async (subjectId, category) => {
      if (subjectId === operatorIdentity.subjectId && category === "operator") {
        return { id: operatorIdentity.userId, deleted: false };
      }

      const accounts = {
        customer: state.customerAccounts,
        business: state.businessAccounts,
        operator: state.operatorAccounts,
      }[category];
      const account = accounts.find((value) => value.subjectId === subjectId);
      return account ? { id: account.id, deleted: account.deleted } : null;
    }),
    isRegistered: vi.fn<AccessQuery["isRegistered"]>().mockResolvedValue(true),
    grant: vi.fn<AccessQuery["grant"]>().mockResolvedValue({
      active: true,
      permissions: [...PLATFORM_PERMISSIONS, ...BUSINESS_PERMISSIONS, ...CUSTOMER_PERMISSIONS],
      protectedRole: true,
    }),
    invitationIsCurrent: vi.fn<AccessQuery["invitationIsCurrent"]>().mockResolvedValue(true),
    hasQualifiedOwner: vi.fn<AccessQuery["hasQualifiedOwner"]>().mockResolvedValue(false),
    qualified: vi.fn<AccessQuery["qualified"]>().mockResolvedValue(true),
    organizations: vi.fn<AccessQuery["organizations"]>().mockResolvedValue([]),
    audit: vi.fn<AccessQuery["audit"]>().mockResolvedValue([]),
  } satisfies AccessQuery;
}
