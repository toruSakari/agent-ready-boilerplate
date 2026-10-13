"use client";
import { t as translate } from "#client/shared/i18n";
import type { ReactNode } from "react";
import { Redirect } from "#client/_app/navigation/redirect";
import { useAuthenticationStatus } from "#client/shared/api/authentication-context";
import { signInUrl } from "#client/shared/config/auth-routes";

/**
 * 遷移前の本人確認はbeforeLoadが担当する。ここは読み込み待ちと、表示中のログアウトを扱う。
 * サービス登録やデータ認可はここでは判定せず、内側の資格ガードとAPIへ委ねる。
 */
export function AuthenticationGate(props: { children: ReactNode }) {
  const authentication = useAuthenticationStatus();
  if (authentication === "loading") {
    return <p>{translate("認証情報を確認しています…")}</p>;
  }

  if (authentication === "signed-out") {
    return <Redirect to={signInUrl(window.location.pathname + window.location.search)} />;
  }

  return props.children;
}
