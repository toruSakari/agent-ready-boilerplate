// @vitest-environment node
import {
  AUDIT_TIMES,
  platform,
  repository,
  reader,
  query,
  access,
  authenticate,
  operator,
  channelFor,
  account,
  memberships,
  invitation,
  setIssuedAt,
  addAccount,
  addMembership,
  register,
  inviteAndAccept,
  legacyCustomerInvitation,
  changedIdentity,
  changedInvitation,
  removeMember,
} from "#api/infrastructure/auth/providers/service-account-lifecycles.integration.test-fixture.ts";
import { expect, it, vi } from "vite-plus/test";

it("サービスを指定した招待の認証・権限・原子性 / 一般ユーザーへの招待・旧所属のロール変更を拒否し管理権限を付与しない", async () => {
  const admin = await operator();
  const legacyId = await addMembership(
    "customer:demo-customer",
    "customer",
    "demo-store",
    "demo-store:owner",
  );
  await expect(
    access.invite(admin, {
      scope: "demo-store",
      email: "customer-admin@example.com",
      roleId: "demo-store:owner",
      actorKind: "customer",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    access.assignRole(admin, {
      scope: "demo-store",
      membershipId: legacyId,
      roleId: "demo-store:staff",
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  const customer = await authenticate("demo-customer", "customer", "demo-store");
  expect(customer.permissions).not.toContain("member.invite");
  expect(customer.permissions).not.toContain("product.update");
  expect((await access.session(customer)).organizations).toEqual([]);
  expect(
    (await repository.load("demo-store")).memberships.some(
      (entry) => entry.userId === customer.userId,
    ),
  ).toBe(false);
  expect(await memberships(customer.userId, "customer")).toEqual([
    expect.objectContaining({ id: legacyId, access_roles_id: "demo-store:owner" }),
  ]);
});

it("メール変更・所属解除・退会をまたぐ招待失効 / 保存済みメールが違っても所属解除より古い招待では復帰できない", async () => {
  const issued = await changedInvitation();
  await setIssuedAt(issued.token, AUDIT_TIMES.issued);
  await removeMember();
  expect(await invitation(issued.token)).not.toBeNull();
  await expect(
    access.acceptInvitation(await changedIdentity(), { token: issued.token, name: "復帰を拒否" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(await memberships("business:demo-member", "business")).toEqual([]);
  expect(await account("demo-member", "business")).toMatchObject({ email: "member@example.com" });
});

it("メール変更・所属解除・退会をまたぐ招待失効 / 所属解除後に再発行した招待は同じ確認済みメールで承諾できる", async () => {
  const old = await changedInvitation();
  await setIssuedAt(old.token, AUDIT_TIMES.issued);
  await removeMember();
  const fresh = await changedInvitation();
  await setIssuedAt(fresh.token, AUDIT_TIMES.reissued);
  const identity = await changedIdentity();
  await expect(
    access.acceptInvitation(identity, { token: old.token, name: "古い招待" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await access.acceptInvitation(identity, { token: fresh.token, name: "再参加" });
  await expect(authenticate("demo-member", "business", "demo-store")).resolves.toMatchObject({
    userId: "business:demo-member",
  });
});

it("メール変更・所属解除・退会をまたぐ招待失効 / 別企業の所属解除は保留招待を無効にしない", async () => {
  const issued = await changedInvitation("demo-second");
  await setIssuedAt(issued.token, AUDIT_TIMES.issued);
  await removeMember();
  await access.acceptInvitation(await changedIdentity(), {
    token: issued.token,
    name: "別企業へ",
  });
  expect(await memberships("business:demo-member", "business")).toEqual([
    expect.objectContaining({ scope: "demo-second" }),
  ]);
  await expect(authenticate("demo-member", "business", "demo-store")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});

it("メール変更・所属解除・退会をまたぐ招待失効 / 同じサービス・同じ保存済みメールの招待は解除時に削除し別企業分は残す", async () => {
  const admin = await operator();
  const removed = await access.invite(admin, {
    scope: "demo-store",
    email: "member@example.com",
    roleId: "demo-store:staff",
    actorKind: "business",
  });
  const retained = await access.invite(admin, {
    scope: "demo-second",
    email: "member@example.com",
    roleId: "demo-second:staff",
    actorKind: "business",
  });
  await removeMember();
  expect(await invitation(removed.token)).toBeNull();
  expect(await invitation(retained.token)).not.toBeNull();
});

it("メール変更・所属解除・退会をまたぐ招待失効 / 所属解除との競合は更新番号で拒否し古いスナップショットから所属を復活させない", async () => {
  const issued = await changedInvitation("demo-second");
  const original = reader.findCurrentInvitation.bind(reader);
  const race = vi
    .spyOn(reader, "findCurrentInvitation")
    .mockImplementationOnce(async (id, subjectId, scope) => {
      const current = await original(id, subjectId, scope);
      expect(current?.id).toBeTruthy();
      expect(subjectId).toBe("demo-member");
      await removeMember();
      return current;
    });
  try {
    await expect(
      access.acceptInvitation(await changedIdentity(), {
        token: issued.token,
        name: "競合した招待",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(race).toHaveBeenCalledOnce();
  } finally {
    race.mockRestore();
  }

  expect(await memberships("business:demo-member", "business")).toEqual([]);
  expect(
    (await query.audit("demo-store")).filter((entry) => entry.action === "invitation.accept"),
  ).toEqual([]);
});

it("メール変更・所属解除・退会をまたぐ招待失効 / 招待発行監査がなければ承諾できず、同時刻の解除も安全側に拒否する", async () => {
  const missingAudit = await changedInvitation("demo-second");
  const stored = await invitation(missingAudit.token);
  await platform.env.DB.prepare(
    "DELETE FROM access_audit WHERE action='member.invite' AND target_id=?",
  )
    .bind(stored!.id)
    .run();
  await expect(
    access.acceptInvitation(await changedIdentity(), {
      token: missingAudit.token,
      name: "監査なし",
    }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  const equalTime = await changedInvitation();
  await setIssuedAt(equalTime.token, AUDIT_TIMES.removed);
  await removeMember();
  await expect(
    access.acceptInvitation(await changedIdentity(), { token: equalTime.token, name: "同時刻" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("メール変更・所属解除・退会をまたぐ招待失効 / 退会前の変更後メール宛て招待は新IDで再登録しても復活しない", async () => {
  const before = await authenticate("demo-customer", "customer");
  const issued = await legacyCustomerInvitation("changed-customer@example.com");
  expect((await invitation(issued.token))?.id).toBe(issued.id);
  await access.withdraw(before);
  const renewed = await register("demo-customer", "changed-customer@example.com");
  expect(renewed.userId).not.toBe(before.userId);
  const identity = await authenticate(
    "demo-customer",
    "customer",
    undefined,
    "access.acceptInvitation",
    "changed-customer@example.com",
  );
  await expect(
    access.acceptInvitation(identity, { token: issued.token, name: "旧招待は失効" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await memberships(renewed.userId, "customer")).toEqual([]);
});

it("メール変更・所属解除・退会をまたぐ招待失効 / 別サービスの退会は同じ主体・メールの保留招待に影響しない", async () => {
  const customer = await register("demo-member", "member@example.com");
  const issued = await access.invite(await operator(), {
    scope: "demo-second",
    email: "member@example.com",
    roleId: "demo-second:staff",
    actorKind: "business",
  });
  await access.withdraw(customer);
  const identity = await authenticate(
    "demo-member",
    "business",
    undefined,
    "access.acceptInvitation",
    "member@example.com",
  );
  await access.acceptInvitation(identity, { token: issued.token, name: "企業会員は継続" });
  expect(await memberships("business:demo-member", "business")).toHaveLength(2);
});

it.each(["business", "operator"] as const)(
  "最後の事業者オーナー・運営管理者の保護 / %sの最後の管理者は所属解除・降格・削除・退会を拒否する",
  async (category) => {
    const scope = category === "operator" ? "platform" : "demo-store";
    const memberId = `${category}:${scope}:demo-user`;
    const accountId = `${category}:demo-user`;
    const admin = await operator();
    await expect(
      access.removeMember(admin, { scope, membershipId: memberId }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      access.assignRole(admin, {
        scope,
        membershipId: memberId,
        roleId: category === "operator" ? "platform:assistant" : "demo-store:staff",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(access.deleteUser(admin, accountId)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      access.withdraw(await authenticate("demo-user", channelFor(category))),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await account("demo-user", category)).toMatchObject({ deleted: 0 });
  },
);

it.each(["business", "operator"] as const)(
  "最後の事業者オーナー・運営管理者の保護 / %sの削除済み代替管理者は最後の管理者に数えない",
  async (category) => {
    const scope = category === "operator" ? "platform" : "demo-store";
    const id = await addAccount("deleted-alternative", category);
    await addMembership(
      id,
      category,
      scope,
      category === "operator" ? "platform:admin" : "demo-store:owner",
    );
    await platform.env.DB.prepare(`UPDATE ${category}_accounts SET deleted=1 WHERE id=?`)
      .bind(id)
      .run();
    expect(await query.hasQualifiedOwner(scope, `${category}:${scope}:demo-user`)).toBe(false);
    await expect(
      access.removeMember(await operator(), {
        scope,
        membershipId: `${category}:${scope}:demo-user`,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  },
);

it("最後の事業者オーナー・運営管理者の保護 / 顧客の同名オーナーロールは事業者の代替オーナーに数えない", async () => {
  await platform.env.DB.prepare(
    "INSERT INTO customer_memberships (id,organizations_id,customer_accounts_id,access_roles_id) VALUES ('customer:legacy-owner','demo-store','customer:demo-customer','demo-store:owner')",
  ).run();
  expect(await query.hasQualifiedOwner("demo-store", "business:demo-store:demo-user")).toBe(false);
  await expect(
    access.removeMember(await operator(), {
      scope: "demo-store",
      membershipId: "business:demo-store:demo-user",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});

it("最後の事業者オーナー・運営管理者の保護 / 停止中企業でも有効な事業者オーナーが二人なら一人を解除できる", async () => {
  await access.assignRole(await operator(), {
    scope: "demo-store",
    membershipId: "business:demo-store:demo-member",
    roleId: "demo-store:owner",
  });
  await access.updateOrganization(await operator(), {
    id: "demo-store",
    name: "停止中の企業",
    active: false,
    invitationsEnabled: true,
  });
  expect(await query.qualified("business:demo-member", "demo-store", "business")).toBe(false);
  expect(await query.hasQualifiedOwner("demo-store", "business:demo-store:demo-user")).toBe(true);
  await access.removeMember(await operator(), {
    scope: "demo-store",
    membershipId: "business:demo-store:demo-user",
  });
  expect(await memberships("business:demo-member", "business")).toEqual([
    expect.objectContaining({ scope: "demo-store", access_roles_id: "demo-store:owner" }),
  ]);
  await expect(
    access.removeMember(await operator(), {
      scope: "demo-store",
      membershipId: "business:demo-store:demo-member",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});

it("所属を失った会員の退会 / 運営所属を解除されても本人の運営退会は可能で他サービスを残す", async () => {
  const subjectId = "removed-operator";
  const customer = await register(subjectId);
  const business = await inviteAndAccept(subjectId, "business");
  const enrolled = await inviteAndAccept(subjectId, "operator", "platform");
  const [membership] = await memberships(enrolled.userId, "operator");
  await access.removeMember(await operator(), {
    scope: "platform",
    membershipId: String(membership!.id),
  });
  await expect(authenticate(subjectId, "admin")).rejects.toMatchObject({ code: "FORBIDDEN" });
  const withdrawal = await authenticate(subjectId, "admin", undefined, "access.withdraw");
  await access.withdraw(withdrawal);
  expect(await account(subjectId, "operator")).toBeNull();
  await expect(authenticate(subjectId, "business")).resolves.toMatchObject({
    userId: business.userId,
  });
  await expect(authenticate(subjectId, "customer")).resolves.toMatchObject({
    userId: customer.userId,
  });
  await expect(access.withdraw(withdrawal)).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("発行者退会時の招待失効 / 企業会員の退会は発行した事業者宛て招待を失効させ一般ユーザー登録は維持する", async () => {
  const customer = await register("demo-member", "member@example.com");
  const role = await access.saveRole(await operator(), {
    scope: "demo-store",
    name: "事業者招待担当",
    permissions: ["order:read", "product.read", "member.invite"],
  });
  await access.assignRole(await operator(), {
    scope: "demo-store",
    membershipId: "business:demo-store:demo-member",
    roleId: role.id,
  });
  const business = await authenticate("demo-member", "business", "demo-store");
  const issued = await access.invite(business, {
    scope: "demo-store",
    email: "issued-business@example.com",
    roleId: "demo-store:staff",
    actorKind: "business",
  });
  await access.withdraw(business);
  expect(await invitation(issued.token)).toBeNull();
  const destination = await authenticate(
    "issued-business",
    "business",
    undefined,
    "access.acceptInvitation",
    "issued-business@example.com",
  );
  await expect(
    access.acceptInvitation(destination, { token: issued.token, name: "失効後" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(authenticate("demo-member", "customer")).resolves.toMatchObject({
    userId: customer.userId,
  });
});
