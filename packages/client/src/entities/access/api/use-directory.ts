"use client";
import { useSuspenseOptionalQuery } from "#client/shared/api/use-suspense-optional-query";
import { useQuery } from "@tanstack/react-query";
import { useService } from "#client/shared/api/client-context";
import { perQueryAccessOptions } from "#client/shared/api/query-access";
import { useTRPC } from "#client/shared/api/trpc";

// 一覧ごとの403は対象セクションだけを止める。ある一覧の不足権限で他の成功した一覧を隠さない。
export function useMembers(scope: string) {
  const t = useTRPC();
  const service = useService(["business", "operator"]);
  return useSuspenseOptionalQuery(
    t.access.members.queryOptions({ scope, service }, perQueryAccessOptions),
  );
}

export function useRoles(scope: string) {
  const t = useTRPC();
  const service = useService(["business", "operator"]);
  return useSuspenseOptionalQuery(
    t.access.roles.queryOptions({ scope, service }, perQueryAccessOptions),
  );
}

/** 操作権限によりenabledで止める候補取得はuseQueryを使い、対象scopeのAPIだけを参照する。 */
export function useRolePermissionCatalog(scope: string, enabled: boolean) {
  const t = useTRPC();
  const service = useService(["business", "operator"]);
  return useQuery(
    t.access.rolePermissionCatalog.queryOptions(
      { scope, service },
      {
        ...perQueryAccessOptions,
        // 呼び出し元の操作可否と、拒否済みクエリの停止条件を両方維持する。
        enabled: (query) => enabled && perQueryAccessOptions.enabled(query),
      },
    ),
  );
}

export function useAudit(scope: string) {
  const t = useTRPC();
  const service = useService(["business", "operator"]);
  return useSuspenseOptionalQuery(
    t.access.audit.queryOptions({ scope, service }, perQueryAccessOptions),
  );
}
