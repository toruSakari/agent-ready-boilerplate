"use client";
import { AppProviders } from "@dev-template/client/providers";
import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

export function BusinessProviders(props: { children: ReactNode; nonce?: string }) {
  const organizationId = useRouterState({
    select: (state) => {
      const params = state.matches.at(-1)?.params;
      return params && "organizationId" in params && typeof params.organizationId === "string"
        ? params.organizationId
        : "";
    },
  });
  // Routerが復号した企業IDを使い、二重復号による別企業への切替を避ける。
  // paramsに単一の企業IDがなければ企業scopeを外す。共有ProviderにアプリのURL解釈を持ち込まない。
  return (
    <AppProviders
      nonce={props.nonce}
      service="business"
      organizationId={typeof organizationId === "string" ? organizationId : ""}
    >
      {props.children}
    </AppProviders>
  );
}
