import { expect, it } from "vite-plus/test";
import {
  organizationPathParamsSchema,
  signInPathParamsSchema,
  ROUTE_PARAM_LIMITS,
} from "#client/shared/config/route-params";

it.each([
  undefined,
  null,
  "",
  " ",
  " tenant",
  "tenant ",
  "tenant\u0000",
  "tenant\r\n",
  "tenant\u007f",
  "a".repeat(201),
  123,
])("不正な企業ID %j は拒否する", (organizationId) => {
  expect(() => organizationPathParamsSchema.parse({ organizationId })).toThrow();
});
it.each([
  "demo-store",
  "tenant/a",
  "tenant%2Fa",
  "企業-A",
  "a".repeat(ROUTE_PARAM_LIMITS.organizationIdMaxLength),
])("有効な識別子 %s を変換せず保持する", (organizationId) => {
  expect(organizationPathParamsSchema.parse({ organizationId })).toEqual({ organizationId });
});
it("ログインの複数段パスを保持し、欠落・制御文字・上限超過は拒否する", () => {
  expect(signInPathParamsSchema.parse({ _splat: "factor-one/verify" })).toEqual({
    _splat: "factor-one/verify",
  });
  for (const _splat of [
    undefined,
    "",
    "sso\ncallback",
    "a".repeat(ROUTE_PARAM_LIMITS.signInPathMaxLength + 1),
  ]) {
    expect(() => signInPathParamsSchema.parse({ _splat })).toThrow();
  }
});
