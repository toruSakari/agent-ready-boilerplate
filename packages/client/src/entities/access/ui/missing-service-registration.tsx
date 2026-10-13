"use client";
import { t as translate } from "#client/shared/i18n";
import type { ReactNode } from "react";
import type { ServiceCategory } from "#client/entities/access/model/types";
import { SERVICE_CATEGORY_LABELS } from "#client/entities/access/model/service-category";

/** サービス未登録の共通表示。顧客登録等のアプリ固有の案内・遷移先はchildrenで受け取る。 */
export function MissingServiceRegistration(props: {
  category: ServiceCategory;
  children?: ReactNode;
}) {
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-bold">
        {props.category === "customer"
          ? translate("会員登録が必要です")
          : translate("{{service}}サービスは未登録です", {
              service: SERVICE_CATEGORY_LABELS[props.category],
            })}
      </h1>
      <p>
        {props.category === "customer"
          ? translate("商品購入には会員登録が必要です。")
          : translate("ログインは完了しています。サービスごとに登録が必要です。")}
      </p>
      {props.children ??
        (props.category !== "customer" && (
          <p>
            {translate("{{contact}}から招待を受け、招待リンクから登録してください。", {
              contact:
                props.category === "business"
                  ? translate("企業の担当者")
                  : translate("運営の管理者"),
            })}
          </p>
        ))}
    </section>
  );
}
