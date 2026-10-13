"use client";
import { AppProviders } from "@dev-template/client/providers";
import type { ReactNode } from "react";

export function WebProviders(props: { children: ReactNode; nonce?: string }) {
  // ストアは販売企業への所属を要求しない。販売企業IDは各API入力で明示する。
  return (
    <AppProviders nonce={props.nonce} service="customer" organizationId="">
      {props.children}
    </AppProviders>
  );
}
