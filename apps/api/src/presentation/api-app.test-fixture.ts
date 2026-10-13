import type { AccessRepository } from "#api/domain/access/repositories/access-repository.ts";

import { beforeEach, expect, vi } from "vite-plus/test";

import type { AccessQuery } from "#api/application/access/queries/access-query.ts";

import type { Identity } from "#api/application/auth/contracts/identity.ts";

import type { IdentityProvider } from "#api/application/auth/providers/identity-provider.ts";

import {
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";

import { AccountIdentityProvider } from "#api/application/auth/providers/account-identity-provider.ts";

import { apiApp } from "#api/presentation/api-app.ts";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn<IdentityProvider["authenticate"]>(),
  load: vi.fn<AccessRepository["load"]>(),
  grant: vi.fn<AccessQuery["grant"]>(),
  plans: vi.fn<AccessQuery["plans"]>().mockReturnValue([]),
  plan: vi.fn<AccessQuery["plan"]>().mockResolvedValue({ code: null, permissions: [] }),
  resolveAccount: vi.fn<AccessQuery["resolveAccount"]>(),
  isRegistered: vi.fn<AccessQuery["isRegistered"]>(),
  invitationIsCurrent: vi.fn<AccessQuery["invitationIsCurrent"]>(),
  hasQualifiedOwner: vi.fn<AccessQuery["hasQualifiedOwner"]>(),
  qualified: vi.fn<AccessQuery["qualified"]>(),
  organizations: vi.fn<AccessQuery["organizations"]>(),
  audit: vi.fn<AccessQuery["audit"]>(),
  session: vi.fn(),
  registration: vi.fn(),
  registerCustomer: vi.fn(),
  withdraw: vi.fn(),
  acceptInvitation: vi.fn(),
  listOrganizations: vi.fn(),
  organizationDirectory: vi.fn(),
  listUsers: vi.fn(),
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  deleteUser: vi.fn(),
  listMembers: vi.fn(),
  roles: vi.fn(),
  rolePermissionCatalog: vi.fn(),
  listPlans: vi.fn(),
  organizationPlan: vi.fn(),
  customerPlans: vi.fn(),
  changeCustomerPlan: vi.fn(),
  assignPlan: vi.fn(),
  saveRole: vi.fn(),
  invite: vi.fn(),
  assignRole: vi.fn(),
  removeMember: vi.fn(),
  accessAudit: vi.fn(),
  createOrder: vi.fn(),
  manageOrder: vi.fn(),
  listOrders: vi.fn(),
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  inventoryList: vi.fn(),
  stockHistory: vi.fn(),
  adjustStock: vi.fn(),
  getStock: vi.fn(),
  changeStock: vi.fn(),
  assertBusinessIp: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: { APP_ENV: "local" } }));

vi.mock("#api/composition-root.ts", () => ({
  createContainer: () => ({
    identityProvider: new AccountIdentityProvider({ authenticate: mocks.authenticate }, mocks),
    accessRepository: { load: mocks.load },
    organizationDirectory: { execute: mocks.organizationDirectory },
    access: {
      assertBusinessIp: mocks.assertBusinessIp,
      session: mocks.session,
      acceptInvitation: mocks.acceptInvitation,
      registration: mocks.registration,
      registerCustomer: mocks.registerCustomer,
      withdraw: mocks.withdraw,
      listOrganizations: mocks.listOrganizations,
      listUsers: mocks.listUsers,
      createOrganization: mocks.createOrganization,
      updateOrganization: mocks.updateOrganization,
      deleteUser: mocks.deleteUser,
      listMembers: mocks.listMembers,
      roles: mocks.roles,
      rolePermissionCatalog: mocks.rolePermissionCatalog,
      listPlans: mocks.listPlans,
      organizationPlan: mocks.organizationPlan,
      customerPlans: mocks.customerPlans,
      changeCustomerPlan: mocks.changeCustomerPlan,
      assignPlan: mocks.assignPlan,
      saveRole: mocks.saveRole,
      invite: mocks.invite,
      assignRole: mocks.assignRole,
      removeMember: mocks.removeMember,
      audit: mocks.accessAudit,
    },
    createOrder: { execute: mocks.createOrder },
    manageOrder: { execute: mocks.manageOrder },
    listOrders: { execute: mocks.listOrders },
    products: { list: mocks.listProducts },
    createProduct: { execute: mocks.createProduct },
    inventoryOverview: { list: mocks.inventoryList, history: mocks.stockHistory },
    manageStock: { get: mocks.getStock, change: mocks.changeStock, adjust: mocks.adjustStock },
  }),
}));

export const services = ["customer", "business", "operator"] as const;

export const unavailableEndpoints = [
  "/api/customer/trpc",
  "/api/business/trpc",
  "/api/admin/trpc",
  "/api/unknown/trpc",
  "/api/trpc-other",
  "/api/trpc2",
  "/api/business/trpc-other",
  "/api/business/trpc2",
  "/api/admin/trpc-other",
  "/api/admin/trpc2",
  "/api/business-other/trpc",
  "/api/admin-other/trpc",
  "/prefix/api/trpc",
];

export const invitationInput = { token: "a".repeat(64), name: "招待された利用者" };

export const orderInput = {
  service: "customer",
  lines: [{ sku: "sku-1", name: "商品", quantity: 1, unitPrice: 100 }],
};

export const productInput = { sku: "sku-1", name: "商品", unitPrice: 100 };

export function request(
  path: string,
  body?: unknown,
  origin = "http://localhost",
  headers?: Record<string, string>,
) {
  return apiApp.request(`${origin}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function query(
  procedure: string,
  input: unknown,
  origin = "http://localhost",
  headers?: Record<string, string>,
) {
  return request(
    `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(input))}`,
    undefined,
    origin,
    headers,
  );
}

export function expectNoServiceWork() {
  for (const [name, mock] of Object.entries(mocks)) {
    if (name !== "authenticate") {
      expect(mock, name).not.toHaveBeenCalled();
    }
  }
}

export function revokeQualifications() {
  mocks.resolveAccount.mockResolvedValue(null);
  mocks.isRegistered.mockResolvedValue(false);
  mocks.qualified.mockResolvedValue(false);
  mocks.organizations.mockResolvedValue([]);
}

function setDtoResults() {
  mocks.assertBusinessIp.mockResolvedValue({ ok: true });
  mocks.changeCustomerPlan.mockResolvedValue({ ok: true });
  mocks.inventoryList.mockResolvedValue({ items: [] });
  mocks.stockHistory.mockResolvedValue({ items: [] });
  mocks.listPlans.mockResolvedValue({ items: [] });
  mocks.roles.mockResolvedValue({ items: [] });
  mocks.listUsers.mockResolvedValue({ items: [] });
  mocks.accessAudit.mockResolvedValue({ items: [] });
  mocks.listOrders.mockResolvedValue({ items: [] });
  mocks.listProducts.mockResolvedValue({ items: [] });
  mocks.listOrganizations.mockResolvedValue({ items: [] });
  mocks.listMembers.mockResolvedValue({ items: [] });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.load.mockResolvedValue({
    version: 1,
    organizations: [],
    customerAccounts: [],
    businessAccounts: [],
    operatorAccounts: [],
    roles: [],
    memberships: [],
    invitations: [],
  });
  mocks.authenticate.mockResolvedValue({
    userId: "user-1",
    subjectId: "user-1",
    tenantId: "",
    role: "member",
    permissions: [],
  });
  mocks.resolveAccount.mockImplementation(async (_subjectId, category) => ({
    id: `${category}:user-1`,
    deleted: false,
  }));
  mocks.isRegistered.mockResolvedValue(true);
  mocks.qualified.mockResolvedValue(true);
  mocks.grant.mockImplementation(async (userId, scope) => ({
    active: true,
    protectedRole: true,
    permissions: permissionsForAccount(userId, scope),
  }));
  mocks.organizations.mockResolvedValue([{ id: "org-1", name: "企業", roleName: "利用者" }]);
  mocks.session.mockImplementation(async (props: { identity: Identity }) => ({
    channel: props.identity.channel,
    accountId: props.identity.userId,
  }));
  mocks.acceptInvitation.mockResolvedValue({ accepted: true });
  mocks.registration.mockImplementation(async (props: { identity: Identity }) => ({
    registered: !!props.identity.userId,
    category: props.identity.channel === "admin" ? "operator" : props.identity.channel,
    accountId: props.identity.userId || null,
  }));
  mocks.registerCustomer.mockResolvedValue({ accountId: "customer:new" });
  mocks.withdraw.mockResolvedValue({ category: "customer" });
  setDtoResults();
});

export const operatorQueries = [
  ["access.plans", { category: "business" }],
  ["access.rolePermissionCatalog", { service: "operator", scope: "org-1" }],
  ["access.session", { service: "operator" }],
  ["access.registration", { service: "operator" }],
  ["health", { service: "operator" }],
  ["access.organizations", {}],
  ["access.users", {}],
  ["access.members", { service: "operator", scope: "platform" }],
  ["access.roles", { service: "operator", scope: "platform" }],
  ["access.audit", { service: "operator", scope: "platform" }],
] as const;

export const operatorMutations = [
  ["access.assignPlan", { category: "business", id: "org-1", planCode: null }],
  ["access.acceptInvitation", { ...invitationInput, service: "operator" }],
  ["access.withdraw", { service: "operator" }],
  ["access.createOrganization", { name: "企業" }],
  [
    "access.updateOrganization",
    { id: "org-1", name: "企業", active: true, invitationsEnabled: true },
  ],
  ["access.deleteUser", { userId: "customer:other" }],
  ["access.saveRole", { service: "operator", scope: "platform", name: "ロール", permissions: [] }],
  [
    "access.invite",
    {
      service: "operator",
      scope: "platform",
      email: "invitee@example.com",
      roleId: "role-1",
      actorKind: "operator",
    },
  ],
  [
    "access.assignRole",
    { service: "operator", scope: "platform", membershipId: "membership-1", roleId: "role-1" },
  ],
  ["access.removeMember", { service: "operator", scope: "platform", membershipId: "membership-1" }],
] as const;

export { mocks };

function permissionsForAccount(userId: string, scope: string) {
  if (scope === "platform") {
    return PLATFORM_PERMISSIONS;
  }

  return userId.startsWith("customer:") ? CUSTOMER_PERMISSIONS : BUSINESS_PERMISSIONS;
}
