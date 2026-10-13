import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ServiceContext, useService } from "#client/shared/api/client-context";
import type { Service } from "#client/shared/api/client-context";

function provider(service: Service) {
  return function Provider(props: { children: ReactNode }) {
    return <ServiceContext.Provider value={service}>{props.children}</ServiceContext.Provider>;
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

// 対象外サービスを別の会員種別へ置き換えると権限境界が曖昧になるため、未指定・対象外は拒否させる。
describe("サービスの明示的な選択", () => {
  it("既定の会員を選ばずアプリにサービスの指定を要求する", () => {
    expect(() => renderHook(() => useService())).toThrow("操作するサービスが指定されていません");
  });

  it.each(["customer", "business", "operator"] as const)(
    "ブラウザーのURLにかかわらず指定された %s サービスを使う",
    (service) => {
      window.history.replaceState(null, "", "/api/admin/trpc/access.session");
      const { result } = renderHook(() => useService(), { wrapper: provider(service) });
      expect(result.current).toBe(service);
    },
  );

  it("現在のサービスが対象外でも権限のある別サービスに置き換えない", () => {
    expect(() =>
      renderHook(() => useService(["business", "operator"]), { wrapper: provider("customer") }),
    ).toThrow("この画面では指定したサービスの操作を利用できません");
  });

  it("顧客・事業者向け操作で運営サービスを事業者サービスに置き換えない", () => {
    expect(() =>
      renderHook(() => useService(["customer", "business"]), { wrapper: provider("operator") }),
    ).toThrow("この画面では指定したサービスの操作を利用できません");
  });
});
