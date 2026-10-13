import type { Identity } from "#api/application/auth/contracts/identity.ts";
import { invokeRuntime } from "#api/test/invoke-runtime.ts";
import type { Fixture } from "#api/application/access/use-cases/service-account-use-cases.test-fixture.ts";
import { INVITATION_TOKEN } from "#api/application/access/use-cases/service-account-values.test-fixture.ts";

export const entryPoints: {
  name: string;
  channel: NonNullable<Identity["channel"]>;
  call: (fixture: Fixture, actor: Identity) => Promise<unknown>;
  rawCall: (fixture: Fixture, actor: Identity) => Promise<unknown>;
}[] = [
  {
    name: "通常会員の登録状況確認",
    channel: "customer",
    call: (f, i) => f.customers.registration(i),
    rawCall: async (f, i) => invokeRuntime(f.raw.customers, "registration", [{ identity: i }]),
  },
  {
    name: "通常会員の登録",
    channel: "customer",
    call: (f, i) => f.customers.register(i, { name: "会員" }),
    rawCall: async (f, i) =>
      invokeRuntime(f.raw.customers, "register", [{ identity: i, input: { name: "会員" } }]),
  },
  {
    name: "通常会員の招待承諾",
    channel: "customer",
    call: (f, i) => f.customers.acceptInvitation(i, { token: INVITATION_TOKEN, name: "会員" }),
    rawCall: async (f, i) =>
      invokeRuntime(f.raw.customers, "acceptInvitation", [
        { _identity: i, _input: { token: INVITATION_TOKEN, name: "会員" } },
      ]),
  },
  {
    name: "通常会員の退会",
    channel: "customer",
    call: (f, i) => f.customers.withdraw(i),
    rawCall: async (f, i) => invokeRuntime(f.raw.customers, "withdraw", [{ identity: i }]),
  },
  {
    name: "企業担当者の登録状況確認",
    channel: "business",
    call: (f, i) => f.businesses.registration(i),
    rawCall: async (f, i) => invokeRuntime(f.raw.businesses, "registration", [{ identity: i }]),
  },
  {
    name: "企業担当者の招待登録",
    channel: "business",
    call: (f, i) =>
      f.businesses.registerFromInvitation(i, { token: INVITATION_TOKEN, name: "担当者" }),
    rawCall: async (f, i) =>
      invokeRuntime(f.raw.businesses, "registerFromInvitation", [
        { identity: i, input: { token: INVITATION_TOKEN, name: "担当者" } },
      ]),
  },
  {
    name: "企業担当者の退会",
    channel: "business",
    call: (f, i) => f.businesses.withdraw(i),
    rawCall: async (f, i) => invokeRuntime(f.raw.businesses, "withdraw", [{ identity: i }]),
  },
  {
    name: "運営会員の登録状況確認",
    channel: "admin",
    call: (f, i) => f.operators.registration(i),
    rawCall: async (f, i) => invokeRuntime(f.raw.operators, "registration", [{ identity: i }]),
  },
  {
    name: "運営会員の招待登録",
    channel: "admin",
    call: (f, i) =>
      f.operators.registerFromInvitation(i, { token: INVITATION_TOKEN, name: "担当者" }),
    rawCall: async (f, i) =>
      invokeRuntime(f.raw.operators, "registerFromInvitation", [
        { identity: i, input: { token: INVITATION_TOKEN, name: "担当者" } },
      ]),
  },
  {
    name: "運営会員の停止",
    channel: "admin",
    call: (f, i) => f.operators.stop(i),
    rawCall: async (f, i) => invokeRuntime(f.raw.operators, "stop", [{ identity: i }]),
  },
];
export const channels: Identity["channel"][] = ["customer", "business", "admin", undefined];
