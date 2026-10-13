"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@dev-template/client/api";

export function useOrganizationMutations() {
  const t = useTRPC();
  const client = useQueryClient();
  const onSuccess = async () => {
    // 企業名・停止・招待設定は一覧だけでなく所属表示や利用権限にも関わるため、access全体を再確認する。
    await client.invalidateQueries(t.access.pathFilter());
  };
  return {
    createOrganization: useMutation(t.access.createOrganization.mutationOptions({ onSuccess })),
    updateOrganization: useMutation(t.access.updateOrganization.mutationOptions({ onSuccess })),
  };
}
