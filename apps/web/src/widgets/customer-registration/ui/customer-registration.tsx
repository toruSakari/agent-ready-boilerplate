"use client";
import { t as translate } from "@dev-template/client/i18n";
import { DataSkeleton } from "@dev-template/client/error-boundary";
import { useServiceRegistration } from "@dev-template/client/entities/access";
import { useAuthenticationStatus } from "@dev-template/client/api";
import { SERVICE_ACCOUNT_PATH, signInUrl } from "@dev-template/client/config";
import { AccountLayout } from "@dev-template/client/account-layout";
import { ThemeMenu } from "@dev-template/client/theme";
import { RegisterCustomer } from "#web/features/register-customer/index.ts";
import { CUSTOMER_REGISTRATION_PATH } from "#web/widgets/customer-registration/model/routes.ts";
import { Button } from "@dev-template/ui/button";
import { Card } from "@dev-template/ui/card";

export function CustomerRegistration() {
  const authentication = useAuthenticationStatus();
  // 公開入口でも未認証の間は登録状況を取得しない。本人確認と一般ユーザー登録を別の状態として扱う。
  const registration = useServiceRegistration(authentication === "signed-in");
  let content;
  if (authentication === "loading") {
    content = <DataSkeleton label={translate("認証情報を確認しています…")} />;
  } else if (authentication === "signed-out") {
    content = (
      <Button asChild>
        <a href={signInUrl(CUSTOMER_REGISTRATION_PATH)}>
          {translate("ログインして会員登録へ進む")}
        </a>
      </Button>
    );
  } else if (registration.isPending) {
    content = <DataSkeleton label={translate("登録状況を確認しています…")} />;
  } else if (registration.data?.registered) {
    content = (
      <>
        <p role="status">{translate("会員登録済みです。")}</p>
        <Button asChild>
          <a href="/">{translate("商品一覧へ")}</a>
        </Button>
        <Button asChild variant="outline">
          <a href={SERVICE_ACCOUNT_PATH}>{translate("登録情報・退会")}</a>
        </Button>
      </>
    );
  } else {
    content = (
      <Card className="grid gap-4 p-5">
        <p>
          {translate(
            "表示名を入力して会員登録してください。ログイン用メールアドレスの確認が必要です。",
          )}
        </p>
        <RegisterCustomer />
      </Card>
    );
  }

  return (
    <AccountLayout title={translate("会員登録")} headerAction={<ThemeMenu />}>
      <p>{translate("商品を購入するための会員登録です。企業への所属や招待は必要ありません。")}</p>
      {/* 確認失敗を未登録と扱わず、フォームを出す前に読み込み・エラー・登録済みを区別する。 */}
      {content}
    </AccountLayout>
  );
}
