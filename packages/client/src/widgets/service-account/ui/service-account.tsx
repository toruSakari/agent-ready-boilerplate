"use client";
import { ServiceWithdrawal } from "#client/widgets/service-account/ui/service-withdrawal";
import { t as translate } from "#client/shared/i18n";
import { DataSkeleton } from "#client/shared/ui/error-boundary";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  MissingServiceRegistration,
  SERVICE_CATEGORY_LABELS,
  useServiceRegistration,
} from "#client/entities/access";
import { ThemeMenu } from "#client/features/switch-theme";
import { AccountLayout } from "#client/shared/ui/account-layout";
import { useService } from "#client/shared/api/client-context";
import { useAuthenticationStatus } from "#client/shared/api/authentication-context";
import { SERVICE_ACCOUNT_PATH, signInUrl } from "#client/shared/config/auth-routes";
import { Button } from "@dev-template/ui/button";

/** 本人確認だけで使う登録・退会画面。所属やサービス資格を失った利用者の入口を塞がない。 */
export function ServiceAccount(props: {
  missingRegistrationContent?: ReactNode;
  registeredContent?: ReactNode;
}) {
  const category = useService();
  const label = SERVICE_CATEGORY_LABELS[category];
  const authentication = useAuthenticationStatus();
  // 業務セッションは要求せず、ログイン確認後に登録状態だけを問い合わせる。
  const registration = useServiceRegistration(authentication === "signed-in");
  const [withdrawn, setWithdrawn] = useState(false);
  let content;
  if (authentication === "loading") {
    content = <DataSkeleton label={translate("認証情報を確認しています…")} />;
  } else if (authentication === "signed-out") {
    content = (
      <Button asChild>
        <a href={signInUrl(SERVICE_ACCOUNT_PATH)}>{translate("ログインして登録情報を確認")}</a>
      </Button>
    );
  } else if (registration.isPending) {
    content = <DataSkeleton label={translate("登録状況を確認しています…")} />;
  } else if (!registration.data?.registered) {
    content = (
      <MissingServiceRegistration category={category}>
        {props.missingRegistrationContent}
      </MissingServiceRegistration>
    );
  } else {
    content = (
      <>
        {props.registeredContent}
        <ServiceWithdrawal category={category} onWithdrawn={() => setWithdrawn(true)} />
      </>
    );
  }

  return (
    <AccountLayout title={accountTitle(category)} headerAction={<ThemeMenu />}>
      {withdrawn && !registration.data?.registered && (
        <p role="status">
          {category === "customer"
            ? translate(
                "通販会員を退会しました。ログインアカウントと他のサービスの登録は残ります。",
              )
            : translate(
                "{{service}}サービスを退会しました。他のサービスとログインアカウントは引き続き利用できます。",
                { service: label },
              )}
        </p>
      )}
      {content}
    </AccountLayout>
  );
}

function accountTitle(category: import("#client/entities/access").ServiceCategory) {
  return category === "customer"
    ? translate("会員情報・退会")
    : translate("{{service}}サービスの登録情報・退会", {
        service: SERVICE_CATEGORY_LABELS[category],
      });
}
