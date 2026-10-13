"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@dev-template/client/api";

/** 一覧のサービス会員IDを削除対象にする。Clerk本人の削除や他サービス会員の一括削除ではない。 */
export function useDeleteUser() {
  const t = useTRPC();
  const client = useQueryClient();
  return useMutation(
    t.access.deleteUser.mutationOptions({
      onSuccess: async () => {
        // 会員の削除で所属も変わるため、ユーザー一覧に限定せず関連するaccessデータを再確認する。
        await client.invalidateQueries(t.access.pathFilter());
      },
    }),
  );
}
