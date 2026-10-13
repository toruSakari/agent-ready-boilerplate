import { AccessOrganizationAssertBusinessIpInputDto } from "#api/application/access/dtos/access-organization-assert-business-ip-input-dto.ts";
// @vitest-environment node
import {
  platform,
  repository,
  query,
  access,
  rawAccess,
  admin,
  business,
} from "#api/infrastructure/access/repositories/access-control.integration.test-fixture.ts";
import { PermissionValue } from "#api/domain/access/value-objects/permission.ts";
import { RoleEntity } from "#api/domain/access/entities/role.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { expect, it } from "vite-plus/test";

it("企業・権限管理のDB境界 / 競合した書き込みは変更も監査ログも保存しない", async () => {
  const state = await repository.load("platform");
  const role = new RoleEntity(
    AccessId.create("custom"),
    AccessId.create("demo-store"),
    AccessName.create("カスタム"),
    ["order:read"].map((value) => PermissionValue.create(value)),
    false,
  );
  const audit = {
    id: "first",
    scope: "demo-store",
    actorId: "operator:demo-user",
    action: "role.save",
    targetId: "custom",
    occurredAt: new Date().toISOString(),
  };
  expect(await repository.commit(state.version, { roles: [role] }, audit)).toBe(true);
  expect(
    await repository.commit(
      state.version,
      { removeMembershipIds: ["business:demo-store:demo-member"] },
      { ...audit, id: "stale" },
    ),
  ).toBe(false);
  // 同じ監査IDを再送しても、古い版の変更や監査を保存しない。
  expect(
    await repository.commit(
      state.version,
      { removeMembershipIds: ["business:demo-store:demo-member"] },
      audit,
    ),
  ).toBe(false);
  expect(await query.grant("business:demo-member", "demo-store")).not.toBeNull();
  expect((await query.audit("demo-store")).map((a) => a.id)).toEqual(["first"]);
});
it("企業・権限管理のDB境界 / 不正な保存権限や状態は復元時に拒否する", async () => {
  await platform.env.DB.prepare("UPDATE organizations SET active=8 WHERE id='demo-store'").run();
  await expect(repository.load("demo-store")).rejects.toThrow();
});
it("企業IP制限の保存と監査 / 運営が設定を保存し、他企業へ波及せず、名称変更でも設定を保持する", async () => {
  await access.updateBusinessIpPolicy(admin, {
    id: "demo-store",
    enabled: true,
    allowedIps: ["203.0.113.0/24", "2001:db8::/32"],
  });
  expect(await access.businessIpPolicy(admin, "demo-store")).toEqual({
    enabled: true,
    allowedIps: ["203.0.113.0/24", "2001:db8::/32"],
  });
  await assertIpResult("demo-store", "203.0.113.20", true);
  await assertIpResult("demo-store", null, false);
  await assertIpResult("demo-store", "198.51.100.1", false);
  await assertIpResult("demo-second", null, true);
  await access.updateOrganization(admin, {
    id: "demo-store",
    name: "新企業名",
    active: true,
    invitationsEnabled: true,
  });
  expect((await access.businessIpPolicy(admin, "demo-store")).enabled).toBe(true);
  expect(
    (await query.audit("platform")).some(
      (entry) => entry.action === "organization.business_ip_policy.update",
    ),
  ).toBe(true);
  await access.updateBusinessIpPolicy(admin, {
    id: "demo-store",
    enabled: false,
    allowedIps: [],
  });
  await assertIpResult("demo-store", null, true);
});
it("企業IP制限の保存と監査 / 企業会員による変更と不正な設定を拒否し、保存状態を変えない", async () => {
  await expect(
    access.updateBusinessIpPolicy(business, {
      id: "demo-store",
      enabled: true,
      allowedIps: ["203.0.113.5"],
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    access.updateBusinessIpPolicy(admin, { id: "demo-store", enabled: true, allowedIps: [] }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(
    access.updateBusinessIpPolicy(admin, {
      id: "demo-store",
      enabled: false,
      allowedIps: ["invalid"],
    }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(await access.businessIpPolicy(admin, "demo-store")).toEqual({
    enabled: false,
    allowedIps: [],
  });
});

async function assertIpResult(scope: string, clientIp: string | null, allowed: boolean) {
  const result = rawAccess.assertBusinessIp(
    AccessOrganizationAssertBusinessIpInputDto.parse({ scope, clientIp }),
  );
  if (allowed) {
    await expect(result).resolves.toEqual({ ok: true });
  } else {
    await expect(result).rejects.toMatchObject({ code: "FORBIDDEN" });
  }
}
