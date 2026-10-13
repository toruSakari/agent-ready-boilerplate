"use client";
import type { Service } from "#client/shared/api/client-context";
import type { ReactNode } from "react";
import { DataProviders } from "#client/_app/providers/data-providers";
import type { TokenProvider } from "#client/_app/providers/token-provider";

export function ScopedDataProviders(props: {
  children: ReactNode;
  getToken: TokenProvider;
  service: Service;
  organizationId: string;
  userId: string;
}) {
  // 同じスコープ内の画面遷移だけでは共有キャッシュを作り直さない。
  // 本人・サービス・企業のいずれかが変わった場合だけ別インスタンスへ切り替える。
  const scopeKey = JSON.stringify([props.userId, props.service, props.organizationId]);
  return (
    <DataProviders
      key={scopeKey}
      getToken={props.getToken}
      service={props.service}
      organizationId={props.organizationId}
    >
      {props.children}
    </DataProviders>
  );
}
