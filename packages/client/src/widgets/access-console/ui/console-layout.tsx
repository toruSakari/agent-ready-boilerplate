"use client";
import { t as translate } from "#client/shared/i18n";
import { useContext } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import { SERVICE_ACCOUNT_PATH } from "#client/shared/config/auth-routes";
import { ThemeMenu } from "#client/features/switch-theme";
import { useOrganizationId, ServiceContext } from "#client/shared/api/client-context";
import { Button } from "@dev-template/ui/button";
import { OrganizationNavigation } from "#client/widgets/access-console/ui/organization-navigation";

/** 共有の枠と導線を描画する。サービス固有メニューは所有アプリがnavigationとして渡す。 */
export function ConsoleLayout(props: {
  title: string;
  children: ReactNode;
  navigation?: ReactNode;
}) {
  const organizationId = useOrganizationId();
  // 拒否画面はサービスProviderの外でも表示するため、表示名だけを任意の文脈から決める。
  const service = useContext(ServiceContext);
  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-6 text-foreground">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{props.title}</h1>
        <ThemeMenu />
      </header>
      <nav className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link<AnyRouter> to={SERVICE_ACCOUNT_PATH}>{translate("登録情報・退会")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link<AnyRouter> to="/">
            {service === "customer" ? translate("商品一覧") : translate("企業選択・ホーム")}
          </Link>
        </Button>
        {organizationId && <OrganizationNavigation organizationId={organizationId} />}
        {props.navigation}
      </nav>
      {props.children}
    </main>
  );
}
