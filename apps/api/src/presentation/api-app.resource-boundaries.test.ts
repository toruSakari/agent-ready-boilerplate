import {
  mocks,
  services,
  invitationInput,
  orderInput,
  request,
  expectNoServiceWork,
  revokeQualifications,
} from "#api/presentation/api-app.test-fixture.ts";
import { expect, it } from "vite-plus/test";

it.each([
  "access.withdraw,order.create/",
  "access.withdraw,order.create//",
  "access.withdraw%2Corder.create/",
])(
  "ライフサイクル操作のバッチ事前検査 / 未登録でも%sは単独処理の制約を回避できない",
  async (procedures) => {
    revokeQualifications();
    const response = await request(`/api/trpc/${procedures}?batch=1`, {
      0: { service: "customer" },
      1: orderInput,
    });
    expect(response.status).toBe(400);
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expectNoServiceWork();
    expect(mocks.withdraw).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  },
);

it.each(services)(
  "ライフサイクル操作のバッチ事前検査 / %sの招待承諾があっても混在バッチ全体を実行しない",
  async (service) => {
    revokeQualifications();
    const response = await request("/api/trpc/access.acceptInvitation,order.create?batch=1", {
      0: { service, ...invitationInput },
      1: orderInput,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual([
      {
        error: expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) }),
      },
      {
        error: expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) }),
      },
    ]);
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expectNoServiceWork();
    expect(mocks.acceptInvitation).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  },
);
