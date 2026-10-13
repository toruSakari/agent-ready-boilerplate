import type { ReactNode } from "react";

export function ApiTokenProvider(props: {
  children: ReactNode;
  getToken: () => Promise<string | null>;
}) {
  return props.children;
}

// Storyの通信は型付きtRPCのfixtureだけで完結させ、汎用fetchへ戻る変更を検出する。
export function useAuthenticatedFetch() {
  return async (): Promise<Response> => {
    throw new Error("StorybookのテストからHTTP通信を行ってはいけません");
  };
}
