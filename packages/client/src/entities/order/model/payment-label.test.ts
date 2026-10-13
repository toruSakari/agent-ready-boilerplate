import { describe, it, expect } from "vite-plus/test";
import { orderPaymentLabel } from "#client/entities/order/model/payment-label";

describe("注文と決済の表示上の区別", () => {
  it("下書きでは金額や遅れて反映された決済状態より未開始を優先する", () => {
    expect(orderPaymentLabel({ status: "draft", total: 0, paymentStatus: "captured" })).toBe(
      "未開始",
    );
  });
  it("無料注文と未反映の有料注文を区別する", () => {
    expect(orderPaymentLabel({ status: "confirmed", total: 0, paymentStatus: null })).toBe(
      "支払い不要",
    );
    expect(orderPaymentLabel({ status: "confirmed", total: 100, paymentStatus: null })).toBe(
      "反映待ち",
    );
  });
  it("注文完了・キャンセルと決済状態を独立して表示する", () => {
    expect(orderPaymentLabel({ status: "completed", total: 100, paymentStatus: "failed" })).toBe(
      "失敗",
    );
    expect(orderPaymentLabel({ status: "cancelled", total: 100, paymentStatus: "captured" })).toBe(
      "売上確定",
    );
  });
});
