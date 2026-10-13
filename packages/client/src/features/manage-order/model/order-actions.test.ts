import { describe, it, expect } from "vite-plus/test";
import { availableOrderActions } from "#client/features/manage-order/model/order-actions";

describe("注文の表示用操作候補", () => {
  it.each([
    ["draft", "customer", ["edit", "confirm", "cancel"]],
    ["draft", "business", ["edit", "confirm", "cancel"]],
    ["confirmed", "customer", ["cancel"]],
    ["confirmed", "business", ["ship", "cancel"]],
    ["shipped", "customer", []],
    ["shipped", "business", ["complete"]],
    ["completed", "customer", []],
    ["completed", "business", []],
    ["cancelled", "customer", []],
    ["cancelled", "business", []],
  ] as const)("状態%s・サービス%sの操作候補を提示する", (status, service, expected) => {
    const actions = availableOrderActions(status, service);
    expect(
      Object.entries(actions)
        .filter((props) => {
          const [, allowed] = props;
          return allowed;
        })
        .map((props) => props[0]),
    ).toEqual(expected);
  });
});
