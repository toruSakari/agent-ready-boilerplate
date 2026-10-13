"use client";
import { t as translate } from "#client/shared/i18n";
import { useEffect } from "react";

// 履歴にガード画面を積まず、戻る操作で同じリダイレクトを繰り返しにくくする。
export function Redirect(props: { to: string }) {
  useEffect(() => {
    window.location.replace(props.to);
  }, [props.to]);
  return <p>{translate("ログイン画面から移動しています…")}</p>;
}
