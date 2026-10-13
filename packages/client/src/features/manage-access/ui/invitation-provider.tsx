"use client";
import { t as translate } from "#client/shared/i18n";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useInvitationState } from "#client/features/manage-access/model/use-invitation-state";
import type { InvitationEntry } from "#client/features/manage-access/model/invitation-session";

const emptyEntry: InvitationEntry = { invitation: null, error: null };
const InvitationContext = createContext({
  ...emptyEntry,
  revision: 0,
  clear: (_token: string, _revision: number): boolean => false,
});
export const useInvitation = () => useContext(InvitationContext);

export function InvitationProvider(props: { children: ReactNode }) {
  const { entry, clear, scrubFailed, preparing } = useInvitationState();
  // 初回の未ログイン訪問でも、Clerkをマウントする前に招待の回収とURLからの消去を済ませる。
  if (scrubFailed) {
    return (
      <p role="alert">
        {translate(
          "招待リンクを安全に開けません。ブラウザーの設定を確認して、招待リンクを開き直してください。",
        )}
      </p>
    );
  }

  // 通常の画面遷移では認証Providerとキャッシュを再マウントしない。
  // 新しい招待fragmentを認証遷移前に消す必要がある場合だけ、子の描画を待たせる。
  if (preparing) {
    return <p>{translate("画面を準備しています…")}</p>;
  }

  return (
    <InvitationContext.Provider value={{ ...entry, clear }}>
      {props.children}
    </InvitationContext.Provider>
  );
}
