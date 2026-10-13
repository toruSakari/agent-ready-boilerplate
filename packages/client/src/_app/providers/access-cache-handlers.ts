import type { RouterOutputs } from "@dev-template/api-types";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { isForbiddenQueryError } from "#client/shared/api/query-access";

// tRPCの入力値から独立して手続きを識別し、資格用クエリ以外を保護データとして扱う。
function procedure(key: QueryKey | undefined) {
  return Array.isArray(key?.[0]) ? key[0].join(".") : undefined;
}

const protectedData = {
  predicate: (query: { queryKey: QueryKey }) =>
    !["access.registration", "access.session"].includes(procedure(query.queryKey) ?? ""),
};

export function isAccessDenial(error: unknown) {
  if (!error || typeof error !== "object" || !("data" in error)) {
    return false;
  }

  const data = error.data;
  return (
    !!data &&
    typeof data === "object" &&
    "code" in data &&
    (data.code === "FORBIDDEN" || data.code === "UNAUTHORIZED")
  );
}

function authorityFingerprint(session: RouterOutputs["access"]["session"]) {
  // 順序だけの差で保護データを捨てないよう、権限と所属を正規化する。
  return JSON.stringify([
    session.userId,
    [...session.permissions].sort(),
    [...session.platformPermissions].sort(),
    session.organizations
      .map((props) => [props.id, props.roleName] as const)
      .sort((props, inputProps) => props[0].localeCompare(inputProps[0])),
  ]);
}

class AccessStateTracker {
  private accountId: string | null | undefined;
  private authority: string | undefined;

  changed(data: unknown, path: string | undefined) {
    if (path === "access.registration") {
      const next = (data as RouterOutputs["access"]["registration"]).accountId;
      const changed = this.accountId !== undefined && this.accountId !== next;
      this.accountId = next;
      return changed;
    }

    if (path !== "access.session") {
      return false;
    }

    const next = authorityFingerprint(data as RouterOutputs["access"]["session"]);
    const changed = this.authority !== undefined && this.authority !== next;
    this.authority = next;
    return changed;
  }
}

export function createAccessCacheHandlers(
  getClient: () => QueryClient,
  refreshSession: (client: QueryClient) => Promise<void>,
) {
  const tracker = new AccessStateTracker();
  const onSuccess = (data: unknown, key: QueryKey) => {
    if (!tracker.changed(data, procedure(key))) {
      return;
    }

    // resetは先行要求を同期的に取り消し、購読側の再描画前に旧データを落とす。
    void getClient().resetQueries(protectedData);
  };
  const onError = (error: unknown, key: QueryKey | undefined, hideSection = false) => {
    if (!isAccessDenial(error)) {
      return;
    }

    const path = procedure(key);
    if (path === "access.session" || path === "access.registration") {
      getClient().removeQueries(protectedData);
    } else if (!hideSection || !isForbiddenQueryError(error)) {
      void refreshSession(getClient());
    }
  };
  return { onSuccess, onError };
}
