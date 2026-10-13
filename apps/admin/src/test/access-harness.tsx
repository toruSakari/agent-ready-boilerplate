import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@dev-template/api-types";
import { TRPCProvider } from "@dev-template/client/api";

type Result = { data?: unknown; error?: string };

/** tRPCの実通信なしに手続き名・入力を記録する。未定義の応答は成功させず、想定外の取得を検出する。 */
export function createAccessTestHarness(results: Record<string, Result>) {
  const requests: { path: string; input: unknown }[] = [];
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpcClient = createTRPCClient<AppRouter>({
    links: [
      () => (props) =>
        observable((observer) => {
          requests.push({ path: props.op.path, input: props.op.input });
          const result = results[props.op.path];
          if (!result) {
            observer.error(new TRPCClientError(`Unexpected access request: ${props.op.path}`));
          } else if (result.error) {
            observer.error(new TRPCClientError(result.error));
          } else {
            observer.next({ result: { data: result.data } });
            observer.complete();
          }

          return () => {};
        }),
    ],
  });
  function Providers(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
          {props.children}
        </TRPCProvider>
      </QueryClientProvider>
    );
  }
  return { Providers, queryClient, requests };
}
