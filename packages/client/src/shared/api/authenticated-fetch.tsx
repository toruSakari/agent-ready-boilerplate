"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type TokenProvider = () => Promise<string | null>;

const TokenContext = createContext({
  getToken: (async () => null) as TokenProvider,
  scopeHeaders: {} as Record<string, string>,
  onForbidden: undefined as (() => void) | undefined,
});

/** 通信スコープは初回値に固定する。本人・企業を切り替える側はProviderを再マウントする。 */
export function ApiTokenProvider(props: {
  getToken: TokenProvider;
  children: ReactNode;
  onForbidden?: () => void;
  scopeHeaders?: Record<string, string>;
}) {
  const { getToken, children, onForbidden, scopeHeaders: initialScopeHeaders = {} } = props;

  // トークン取得を待つ要求に、後から選択した別企業のヘッダーを混ぜない。
  const [scopeHeaders] = useState(() => initialScopeHeaders);
  return (
    <TokenContext.Provider value={{ getToken, scopeHeaders, onForbidden }}>
      {children}
    </TokenContext.Provider>
  );
}

/** 呼び出し元のURLへ認証付きfetchを行う。サービス別のURL変換やpathnameからの企業推測はしない。 */
export function useAuthenticatedFetch() {
  const { getToken, scopeHeaders, onForbidden } = useContext(TokenContext);
  return async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    // 任意の追加ヘッダーよりProviderの企業スコープを優先する。認可自体はAPIが検証する。
    for (const [key, value] of Object.entries(scopeHeaders)) {
      headers.set(key, value);
    }

    const token = await getToken();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    const response = await fetch(url, { ...options, headers });
    // 資格再確認を通知しても応答は消費しない。呼び出し元が元の失敗を表示・処理できる。
    if (response.status === 403 || response.status === 401) {
      onForbidden?.();
    }

    return response;
  };
}
