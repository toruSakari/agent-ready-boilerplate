"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useService } from "#client/shared/api/client-context";
import { useTRPC } from "#client/shared/api/trpc";

// 資格ガードと同じサービス別QueryKeyを使い、同一スコープでセッション確認を共有する。
export function useAccessSession() {
  const trpc = useTRPC();
  const service = useService();
  const query = useSuspenseQuery(trpc.access.session.queryOptions({ service }));
  if (query.error) {
    throw query.error;
  }

  return query;
}
