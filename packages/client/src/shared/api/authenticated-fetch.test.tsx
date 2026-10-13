import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { ApiTokenProvider, useAuthenticatedFetch } from "#client/shared/api/authenticated-fetch";
import { ServiceContext } from "#client/shared/api/client-context";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

// pathnameとProviderの企業IDをあえて食い違わせ、URL推測ではなく明示スコープが通信を決めることを検証する。
it.each(["customer", "business", "operator"] as const)(
  "共通エンドポイントへの認証付き通信" +
    " / " +
    "%s で明示されたエンドポイントと指定された企業を維持する",
  async (service) => {
    window.history.replaceState(null, "", "/organizations/another-tenant");
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("image"));
    vi.stubGlobal("fetch", fetch);
    function Provider(props: { children: ReactNode }) {
      return (
        <ServiceContext.Provider value={service}>
          <ApiTokenProvider
            getToken={async () => "token"}
            scopeHeaders={{ "x-organization-id": "tenant-a" }}
          >
            {props.children}
          </ApiTokenProvider>
        </ServiceContext.Provider>
      );
    }
    const { result } = renderHook(() => useAuthenticatedFetch(), { wrapper: Provider });
    await result.current("/api/products/product-1/image?service=customer");
    expect(fetch.mock.calls[0]?.[0]).toBe("/api/products/product-1/image?service=customer");
    const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);
    expect(headers.get("authorization")).toBe("Bearer token");
    expect(headers.get("x-organization-id")).toBe("tenant-a");
  },
);

it(
  "共通エンドポイントへの認証付き通信" +
    " / " +
    "省略された企業スコープをブラウザーのpathnameから推測しない",
  async () => {
    window.history.replaceState(null, "", "/organizations/tenant-a");
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("image"));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useAuthenticatedFetch(), {
      wrapper: (props) => (
        <ApiTokenProvider getToken={async () => "token"}>{props.children}</ApiTokenProvider>
      ),
    });
    await result.current("/api/products/product-1/image?service=business");
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).has("x-organization-id")).toBe(false);
  },
);

it(
  "共通エンドポイントへの認証付き通信" +
    " / " +
    "画像の認可エラーをセッション再検証へ通知し、操作の応答は保持する",
  async () => {
    const denied = vi.fn();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useAuthenticatedFetch(), {
      wrapper: (props) => (
        <ApiTokenProvider getToken={async () => "token"} onForbidden={denied}>
          {props.children}
        </ApiTokenProvider>
      ),
    });
    const response = await result.current("/api/products/product-1/image?service=business");
    expect(response.status).toBe(403);
    expect(denied).toHaveBeenCalledTimes(1);
  },
);

it(
  "共通エンドポイントへの認証付き通信" +
    " / " +
    "呼び出し前にページ移動しても以前の通信処理は指定された企業に固定する",
  async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("image"));
    vi.stubGlobal("fetch", fetch);
    let scopeHeaders = { "x-organization-id": "tenant-a" };
    const { result, rerender } = renderHook(() => useAuthenticatedFetch(), {
      wrapper: (props) => (
        <ApiTokenProvider
          key={scopeHeaders["x-organization-id"]}
          getToken={async () => "token"}
          scopeHeaders={scopeHeaders}
        >
          {props.children}
        </ApiTokenProvider>
      ),
    });
    const oldFetch = result.current;
    scopeHeaders = { "x-organization-id": "tenant-b" };
    window.history.replaceState(null, "", "/organizations/tenant-b");
    rerender();
    await oldFetch("/api/products/product-1/image?service=business");
    await result.current("/api/products/product-1/image?service=business");
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("x-organization-id")).toBe(
      "tenant-a",
    );
    expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).get("x-organization-id")).toBe(
      "tenant-b",
    );
  },
);

it(
  "共通エンドポイントへの認証付き通信" +
    " / " +
    "トークン取得前にスコープを確定し、要求を送信するまで維持する",
  async () => {
    const token = Promise.withResolvers<string | null>();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("image"));
    vi.stubGlobal("fetch", fetch);
    let scopeHeaders = { "x-organization-id": "tenant-a" };
    const { result, rerender } = renderHook(() => useAuthenticatedFetch(), {
      wrapper: (props) => (
        <ApiTokenProvider
          key={scopeHeaders["x-organization-id"]}
          getToken={() => token.promise}
          scopeHeaders={scopeHeaders}
        >
          {props.children}
        </ApiTokenProvider>
      ),
    });
    const pending = result.current("/api/products/product-1/image?service=business");
    scopeHeaders = { "x-organization-id": "tenant-b" };
    rerender();
    token.resolve("delayed-token");
    await pending;
    const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);
    expect(headers.get("x-organization-id")).toBe("tenant-a");
    expect(headers.get("authorization")).toBe("Bearer delayed-token");
  },
);
