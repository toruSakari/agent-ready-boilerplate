import { DEVELOPMENT_CATALOG } from "#api-tooling/seeds/development-catalog.ts";
import type { DevelopmentCatalogProduct } from "#api-tooling/seeds/development-catalog.ts";
import {
  BUSINESS_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import { DEMO_PLAN_CODES } from "#api/domain/access/policies/plan-catalog.ts";

// デモの所属とロールは明示し、DBや実行環境には依存しない。
const roles = [
  {
    id: "platform:admin",
    scope: "platform",
    name: "管理者",
    protectedRole: true,
    permissions: PLATFORM_PERMISSIONS,
  },
  {
    id: "platform:assistant",
    scope: "platform",
    name: "準管理者",
    protectedRole: false,
    permissions: ["organization.read", "user.read", "member.read"],
  },
  {
    id: "demo-store:owner",
    scope: "demo-store",
    name: "オーナー",
    protectedRole: true,
    permissions: BUSINESS_PERMISSIONS,
  },
  {
    id: "demo-store:staff",
    scope: "demo-store",
    name: "スタッフ",
    protectedRole: false,
    permissions: ["order:read", "product.read"],
  },
  {
    id: "demo-second:owner",
    scope: "demo-second",
    name: "オーナー",
    protectedRole: true,
    permissions: BUSINESS_PERMISSIONS,
  },
  {
    id: "demo-second:staff",
    scope: "demo-second",
    name: "スタッフ",
    protectedRole: false,
    permissions: ["order:read", "product.read"],
  },
] satisfies readonly {
  id: string;
  scope: string;
  name: string;
  protectedRole: boolean;
  permissions: readonly PermissionCode[];
}[];

export const DEVELOPMENT_FIXTURE = {
  catalog: DEVELOPMENT_CATALOG,
  roles,
  organizations: [
    {
      id: "demo-store",
      name: "デモ企業A",
      active: true,
      invitationsEnabled: true,
      planCode: DEMO_PLAN_CODES.business,
    },
    {
      id: "demo-second",
      name: "デモ企業B",
      active: true,
      invitationsEnabled: true,
      planCode: DEMO_PLAN_CODES.business,
    },
  ],
  operatorAccounts: [
    {
      id: "operator:demo-user",
      subjectId: "demo-user",
      name: "デモ管理者",
      email: "demo@example.com",
      deleted: false,
    },
  ],
  businessAccounts: [
    {
      id: "business:demo-user",
      subjectId: "demo-user",
      name: "デモ管理者",
      email: "demo@example.com",
      deleted: false,
    },
    {
      id: "business:demo-member",
      subjectId: "demo-member",
      name: "デモ閲覧担当",
      email: "member@example.com",
      deleted: false,
    },
  ],
  customerAccounts: [
    {
      id: "customer:demo-user",
      subjectId: "demo-user",
      name: "デモ一般ユーザー",
      email: "demo@example.com",
      deleted: false,
      planCode: DEMO_PLAN_CODES.customer,
    },
    {
      id: "customer:demo-customer",
      subjectId: "demo-customer",
      name: "デモ一般ユーザー",
      email: "customer@example.com",
      deleted: false,
      planCode: DEMO_PLAN_CODES.customer,
    },
  ],
  operatorMemberships: [
    {
      id: "operator:platform:demo-user",
      scope: "platform",
      operatorAccountsId: "operator:demo-user",
      accessRolesId: "platform:admin",
    },
  ],
  businessMemberships: [
    {
      id: "business:demo-store:demo-user",
      organizationsId: "demo-store",
      businessAccountsId: "business:demo-user",
      accessRolesId: "demo-store:owner",
    },
    {
      id: "business:demo-second:demo-user",
      organizationsId: "demo-second",
      businessAccountsId: "business:demo-user",
      accessRolesId: "demo-second:owner",
    },
    {
      id: "business:demo-store:demo-member",
      organizationsId: "demo-store",
      businessAccountsId: "business:demo-member",
      accessRolesId: "demo-store:staff",
    },
  ],
  customerMemberships: [],
};

export type DevelopmentFixture = Omit<typeof DEVELOPMENT_FIXTURE, "catalog"> & {
  catalog?: DevelopmentCatalogProduct[];
};
