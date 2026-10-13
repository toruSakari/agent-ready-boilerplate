import { products } from "#api/infrastructure/product/schemas/schema.ts";
import { inventoryItems } from "#api/infrastructure/inventory/schemas/schema.ts";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { DEVELOPMENT_FIXTURE } from "#api-tooling/seeds/development-fixture.ts";
import type { DevelopmentFixture } from "#api-tooling/seeds/development-fixture.ts";
import {
  organizations,
  accessRoles,
  rolePermissions,
  operatorAccounts,
  businessAccounts,
  customerAccounts,
  operatorMemberships,
  businessMemberships,
} from "#api/infrastructure/access/schemas/schema.ts";

/** 接続を呼び出し側から受け取り、固定データだけを一度の原子的なbatchで投入する。 */
export async function seedDevelopment(
  db: DrizzleD1Database,
  fixture: DevelopmentFixture = DEVELOPMENT_FIXTURE,
) {
  await db.batch([
    db
      .insert(organizations)
      .values(fixture.organizations)
      .onConflictDoUpdate({
        target: organizations.id,
        set: { planCode: sql`excluded.${sql.identifier(organizations.planCode.name)}` },
      }),
    ...catalogStatements(db, fixture.catalog ?? []),
    ...authorizationStatements(db, fixture),
    ...accountStatements(db, fixture),
    ...membershipStatements(db, fixture),
  ]);
}

function catalogStatements(
  db: DrizzleD1Database,
  catalog: NonNullable<DevelopmentFixture["catalog"]>,
) {
  return [
    // 商品・在庫は初回だけ投入し、開発中の価格変更や購入による在庫変化を戻さない。
    ...catalog.map((props) => {
      const { initialStock: _stock, ...product } = props;
      return db.insert(products).values(product).onConflictDoNothing();
    }),
    ...catalog.map((product) =>
      db
        .insert(inventoryItems)
        .values({
          tenantId: product.tenantId,
          sku: product.sku,
          onHand: product.initialStock,
          updatedAt: product.createdAt,
        })
        .onConflictDoNothing({ target: [inventoryItems.tenantId, inventoryItems.sku] }),
    ),
  ];
}

function authorizationStatements(db: DrizzleD1Database, fixture: DevelopmentFixture) {
  const grants = fixture.roles.flatMap((props) =>
    props.permissions.map((permission) => ({
      id: `${props.id}:${permission}`,
      accessRolesId: props.id,
      permissionsId: permission,
    })),
  );
  return [
    db
      .insert(accessRoles)
      .values(
        fixture.roles.map((props) => {
          const { permissions: _permissions, ...role } = props;
          return role;
        }),
      )
      .onConflictDoNothing({ target: accessRoles.id }),
    // D1の文ごとのパラメータ上限を避けても、同じbatch内なので途中失敗は全体が戻る。
    ...grants.map((grant) =>
      db
        .insert(rolePermissions)
        .values(grant)
        .onConflictDoNothing({
          target: [rolePermissions.accessRolesId, rolePermissions.permissionsId],
        }),
    ),
  ];
}

function accountStatements(db: DrizzleD1Database, fixture: DevelopmentFixture) {
  return [
    db
      .insert(operatorAccounts)
      .values(fixture.operatorAccounts)
      .onConflictDoNothing({ target: operatorAccounts.id }),
    db
      .insert(businessAccounts)
      .values(fixture.businessAccounts)
      .onConflictDoNothing({ target: businessAccounts.id }),
    // 再実行で戻すのはデモのプランだけ。名前・退会・所属・変更済みロールは維持する。
    db
      .insert(customerAccounts)
      .values(fixture.customerAccounts)
      .onConflictDoUpdate({
        target: customerAccounts.id,
        set: { planCode: sql`excluded.${sql.identifier(customerAccounts.planCode.name)}` },
      }),
  ];
}

function membershipStatements(db: DrizzleD1Database, fixture: DevelopmentFixture) {
  return [
    db
      .insert(operatorMemberships)
      .values(fixture.operatorMemberships)
      .onConflictDoNothing({
        target: [operatorMemberships.scope, operatorMemberships.operatorAccountsId],
      }),
    db
      .insert(businessMemberships)
      .values(fixture.businessMemberships)
      .onConflictDoNothing({
        target: [businessMemberships.organizationsId, businessMemberships.businessAccountsId],
      }),
  ];
}
