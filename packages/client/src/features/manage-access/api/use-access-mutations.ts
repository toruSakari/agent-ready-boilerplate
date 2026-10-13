"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "#client/shared/api/trpc";

export function useAccessMutations() {
  const t = useTRPC();
  const client = useQueryClient();
  const onSuccess = async () => {
    // 所属・ロール変更より前のスナップショットを取り消してから現在の権限を取得し直す。
    await client.cancelQueries(t.access.pathFilter());
    await client.invalidateQueries(t.access.pathFilter());
  };
  const onAccepted = async () => {
    // 招待承諾では会員や所属が増えるため、旧セッションと非表示中の旧キャッシュを持ち越さない。
    // 有効なaccess購読はresetで取り直し、資格変化に応じた業務データ更新へつなぐ。
    await client.cancelQueries();
    client.removeQueries({ predicate: (query) => !query.isActive() });
    await client.resetQueries(t.access.pathFilter());
  };
  return {
    invite: useMutation(t.access.invite.mutationOptions({ onSuccess })),
    assignRole: useMutation(t.access.assignRole.mutationOptions({ onSuccess })),
    removeMember: useMutation(t.access.removeMember.mutationOptions({ onSuccess })),
    saveRole: useMutation(t.access.saveRole.mutationOptions({ onSuccess })),
    acceptInvitation: useMutation(
      t.access.acceptInvitation.mutationOptions({ onSuccess: onAccepted }),
    ),
  };
}
