import { organizationHeaders } from "#client/shared/api/client-context";
import type { TokenProvider } from "#client/_app/providers/token-provider";
import { QUERY_POLICY } from "#client/_app/providers/query-policy";
import {
  createTRPCClient,
  httpBatchLink,
  httpLink,
  isNonJsonSerializable,
  splitLink,
} from "@trpc/client";
import type { AppRouter } from "@dev-template/api-types";

export function createScopedTRPCClient(getToken: TokenProvider, organizationId: string) {
  // トークン取得中に画面が別企業へ移っても、開始時のスコープに要求を固定する。
  const scopeHeaders = organizationHeaders(organizationId);
  const transport = {
    url: "/api/trpc",
    headers: async () => {
      const token = await getToken();
      return { ...scopeHeaders, ...(token ? { authorization: `Bearer ${token}` } : {}) };
    },
  };
  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (operation) =>
          isNonJsonSerializable(operation.input) ||
          ["product.getImage", "store.getImage"].includes(operation.path),
        // FormDataと大きい画像応答は単独のtRPC要求にし、通常のJSONバッチへ混ぜない。
        true: httpLink({
          ...transport,
          fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
        }),
        false: splitLink({
          condition: (operation) =>
            [
              "access.registration",
              "access.registerCustomer",
              "access.withdraw",
              "access.acceptInvitation",
            ].includes(operation.path),
          // 登録・退会・招待承諾はサーバーが単独実行を要求する。
          // 同じtickで業務要求が発生しても、ライフサイクル操作を混合バッチへ入れない。
          true: httpBatchLink({ ...transport, maxItems: QUERY_POLICY.lifecycleBatchMaxItems }),
          false: httpBatchLink({ ...transport, maxItems: QUERY_POLICY.rpcBatchMaxItems }),
        }),
      }),
    ],
  });
}
