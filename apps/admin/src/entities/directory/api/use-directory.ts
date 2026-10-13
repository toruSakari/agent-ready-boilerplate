"use client";
import {
  useSuspenseOptionalQuery,
  useTRPC,
  perQueryAccessOptions,
  LIST_PAGE_SIZE,
} from "@dev-template/client/api";

// ローカルの権限一覧で取得を止めず、各APIの現在の判定を使う。403は該当一覧だけの拒否にする。
export function useOrganizations() {
  const t = useTRPC();
  return useSuspenseOptionalQuery(
    t.access.organizations.queryOptions(undefined, perQueryAccessOptions),
  );
}

export function useUsers() {
  const t = useTRPC();
  return useSuspenseOptionalQuery(t.access.users.queryOptions(undefined, perQueryAccessOptions));
}

export function useOrganizationDirectory(
  filters: { search?: string; status?: "active" | "inactive"; planCode?: string },
  afterId?: string,
) {
  const trpc = useTRPC();
  return useSuspenseOptionalQuery(
    trpc.access.organizationDirectory.queryOptions(
      { ...filters, limit: LIST_PAGE_SIZE, afterId },
      perQueryAccessOptions,
    ),
  );
}
