"use client";
import { t as translate } from "#client/shared/i18n";
import type { RouterInputs } from "@dev-template/api-types";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export type Service = RouterInputs["access"]["session"]["service"];

export const ServiceContext = createContext<Service | null>(null);

/** アプリが明示した操作主体を返す。未指定・対象外では代替サービスを選ばず失敗させる。 */
export function useService(): Service;
export function useService<T extends Service>(allowed: readonly T[]): T;

export function useService(allowed?: readonly Service[]): Service {
  const service = useContext(ServiceContext);
  if (!service) {
    throw new Error(translate("操作するサービスが指定されていません"));
  }

  if (allowed && !allowed.includes(service)) {
    throw new Error(translate("この画面では指定したサービスの操作を利用できません"));
  }

  return service;
}

// 企業IDは操作対象の指定であり認可の証明ではない。APIが本人の所属を別途確認する。
export function organizationHeaders(id: string): Record<string, string> {
  return id ? { "x-organization-id": id } : {};
}

export const OrganizationContext = createContext("");
export const useOrganizationId = () => useContext(OrganizationContext);

/** 表示用の選択企業を渡す。通信ヘッダーのスコープはAppProvidersへも明示する。 */
export function OrganizationScope(props: { id: string; children: ReactNode }) {
  return (
    <OrganizationContext.Provider value={props.id}>{props.children}</OrganizationContext.Provider>
  );
}
