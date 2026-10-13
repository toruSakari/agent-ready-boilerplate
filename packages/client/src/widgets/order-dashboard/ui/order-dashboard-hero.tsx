import { t as translate } from "#client/shared/i18n";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import { SERVICE_ACCOUNT_PATH } from "#client/shared/config/auth-routes";
import { Button } from "@dev-template/ui/button";
import { Badge } from "@dev-template/ui/badge";
import { OrderBackendServices } from "#client/widgets/order-dashboard/ui/order-backend-services";

export function OrderDashboardHero(props: { navigation?: ReactNode }) {
  return (
    <section className="flex flex-col justify-between gap-10 rounded-[2rem] bg-hero p-8 text-hero-foreground shadow-2xl lg:p-12">
      <div>
        <div className="mb-10 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-hero-accent">
            dev-template
          </p>
          <Badge variant="outline" className="border-hero-border px-3 py-1 text-hero-muted">
            Cloudflare native
          </Badge>
        </div>
        <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          {translate("実際の業務に使える、エッジ基盤。")}
        </h1>
        {props.navigation}
        <Button asChild variant="outline" className="mt-3">
          <Link<AnyRouter> to="/">{translate("企業を切り替える")}</Link>
        </Button>
        <Button asChild variant="outline" className="mt-3">
          <Link<AnyRouter> to={SERVICE_ACCOUNT_PATH}>{translate("登録情報・退会")}</Link>
        </Button>
        <p className="mt-6 max-w-xl text-base leading-7 text-hero-muted sm:text-lg">
          {translate("TanStack Start・Hono・tRPCとDDDを、軽量FSDのクライアントへ接続します。")}
        </p>
      </div>

      <OrderBackendServices />
    </section>
  );
}
