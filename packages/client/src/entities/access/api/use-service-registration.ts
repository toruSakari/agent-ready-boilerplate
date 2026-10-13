"use client";
import { useQuery } from "@tanstack/react-query";
import { useService } from "#client/shared/api/client-context";
import { useTRPC } from "#client/shared/api/trpc";

/** 認証待ち・未ログインではenabledで止めるためuseQueryを使い、所属ではなく本人の登録だけを確認する。 */
export function useServiceRegistration(enabled: boolean) {
  const trpc = useTRPC();
  const service = useService();
  return useQuery(
    trpc.access.registration.queryOptions(
      { service },
      {
        enabled,
        retry: false,
        staleTime: 0,
        refetchOnMount: "always",
        refetchOnWindowFocus: "always",
        refetchOnReconnect: "always",
      },
    ),
  );
}
