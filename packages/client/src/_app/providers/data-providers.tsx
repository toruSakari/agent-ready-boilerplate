"use client";
import {
  ServiceContext,
  OrganizationContext,
  organizationHeaders,
} from "#client/shared/api/client-context";
import type { Service } from "#client/shared/api/client-context";
import {
  createScopedQueryClient,
  refreshAccessSession,
} from "#client/_app/providers/session-cache";
import { DataErrorBoundary } from "#client/shared/ui/error-boundary";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ApiTokenProvider } from "#client/shared/api/authenticated-fetch";
import { TRPCProvider } from "#client/shared/api/trpc";
import { createScopedTRPCClient } from "#client/_app/providers/scoped-trpc-client";
import type { TokenProvider } from "#client/_app/providers/token-provider";

export function DataProviders(props: {
  children: ReactNode;
  getToken: TokenProvider;
  service: Service;
  organizationId: string;
}) {
  const [queryClient] = useState(createScopedQueryClient);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // StrictModeのeffect再実行では直ちに再接続されるため、同じキャッシュを消さない。
      // microtaskまで再接続がなかった場合だけ、離脱したスコープの取得とデータを破棄する。
      queueMicrotask(() => {
        if (mounted.current) {
          return;
        }

        void queryClient.cancelQueries();
        queryClient.clear();
      });
    };
  }, [queryClient]);
  const [trpcClient] = useState(() => createScopedTRPCClient(props.getToken, props.organizationId));

  return (
    <ServiceContext.Provider value={props.service}>
      <OrganizationContext.Provider value={props.organizationId}>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
            <ApiTokenProvider
              getToken={props.getToken}
              scopeHeaders={organizationHeaders(props.organizationId)}
              onForbidden={() => void refreshAccessSession(queryClient)}
            >
              <DataErrorBoundary>{props.children}</DataErrorBoundary>
            </ApiTokenProvider>
          </TRPCProvider>
        </QueryClientProvider>
      </OrganizationContext.Provider>
    </ServiceContext.Provider>
  );
}
