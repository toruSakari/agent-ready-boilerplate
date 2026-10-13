// @vitest-environment node
import { expect, it, vi } from "vite-plus/test";
import { loadRouteAccess } from "#client/_app/navigation/load-route-access";

function requestUrl(input: Parameters<typeof fetch>[0]) {
  if (input instanceof Request) {
    return input.url;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input;
}

function transport(props: { registered?: boolean; userId?: string; code?: string } = {}) {
  const { registered = true, userId = "account-1", code } = props;

  return vi.fn<typeof fetch>(async (url) => {
    if (code) {
      return Response.json(
        {
          error: {
            message: "拒否",
            code: -32001,
            data: { code, httpStatus: code === "UNAUTHORIZED" ? 401 : 403 },
          },
        },
        { status: code === "UNAUTHORIZED" ? 401 : 403 },
      );
    }

    return Response.json({
      result: {
        data: requestUrl(url).includes("access.registration")
          ? { registered, category: "business", accountId: registered ? "account-1" : null }
          : { userId },
      },
    });
  });
}

const request = new Request("https://business.example.com/organizations/old", {
  headers: { "x-organization-id": "old", "cf-access-jwt-assertion": "access-proof" },
});
it(
  "ルートの資格照会とAPI境界" +
    " / " +
    "遷移先企業とCookieのJWTをAPIへ渡し、本人確認の後に資格を確認する",
  async () => {
    const fetch = transport();
    expect(
      await loadRouteAccess({
        request,
        service: "business",
        input: { qualified: true, organizationId: "tenant/a" },
        sessionToken: "jwt",
        fetch,
      }),
    ).toBe("registered");
    expect(fetch.mock.calls).toHaveLength(2);
    for (const [url, options] of fetch.mock.calls) {
      expect(JSON.parse(new URL(requestUrl(url)).searchParams.get("input")!)).toEqual({
        service: "business",
      });
      const headers = new Headers(options?.headers);
      expect(headers.get("x-organization-id")).toBe("tenant/a");
      expect(headers.get("authorization")).toBe("Bearer jwt");
      expect(headers.get("cf-access-jwt-assertion")).toBe("access-proof");
    }

    expect(requestUrl(fetch.mock.calls[0]![0])).toContain("access.registration");
    expect(requestUrl(fetch.mock.calls[1]![0])).toContain("access.session");
  },
);

it.each([false, true])(
  "ルートの資格照会とAPI境界" + " / " + "未登録ならqualified=%sでも業務セッションを取得しない",
  async (qualified) => {
    const fetch = transport({ registered: false });
    expect(
      await loadRouteAccess({ request, service: "business", input: { qualified }, fetch }),
    ).toBe("unregistered");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).has("x-organization-id")).toBe(false);
  },
);

it(
  "ルートの資格照会とAPI境界" + " / " + "本人だけを確認するaccountでは資格を取得しない",
  async () => {
    const fetch = transport();
    expect(
      await loadRouteAccess({ request, service: "business", input: { qualified: false }, fetch }),
    ).toBe("registered");
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);

it.each([
  ["UNAUTHORIZED", "signed-out"],
  ["FORBIDDEN", "forbidden"],
] as const)(
  "ルートの資格照会とAPI境界" + " / " + "APIの%sを許可扱いにしない",
  async (code, expected) => {
    expect(
      await loadRouteAccess({
        request,
        service: "business",
        input: { qualified: true },
        fetch: transport({ code }),
      }),
    ).toBe(expected);
  },
);

it(
  "ルートの資格照会とAPI境界" + " / " + "登録とセッションの会員IDが異なれば利用を止める",
  async () => {
    expect(
      await loadRouteAccess({
        request,
        service: "business",
        input: { qualified: true },
        fetch: transport({ userId: "account-2" }),
      }),
    ).toBe("unavailable");
  },
);

it("ルートの資格照会とAPI境界" + " / " + "基盤障害の本文・例外をブラウザーへ返さない", async () => {
  expect(
    await loadRouteAccess({
      request,
      service: "business",
      input: { qualified: true },
      fetch: vi.fn().mockRejectedValue(new Error("secret infrastructure detail")),
    }),
  ).toBe("unavailable");
});
