"use client";
import { t as translate } from "#client/shared/i18n";
import { OrderCreationPanel } from "#client/widgets/order-dashboard/ui/order-creation-panel";
import { OrderDashboardHero } from "#client/widgets/order-dashboard/ui/order-dashboard-hero";

import type { ReactNode } from "react";
import { DataErrorBoundary } from "#client/shared/ui/error-boundary";
import { OrderList } from "#client/widgets/order-dashboard/ui/order-list";

import { ThemeMenu } from "#client/features/switch-theme";

/** 顧客・企業で共有する注文画面。アプリ固有の業務メニューはnavigationとして受け取る。 */
export function OrderDashboard(props: { navigation?: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl justify-end px-6 pt-6">
        <ThemeMenu />
      </div>
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
        <OrderDashboardHero navigation={props.navigation} />

        <section className="grid content-start gap-6">
          <OrderCreationPanel />

          <DataErrorBoundary loadingLabel={translate("注文を読み込み中…")}>
            <OrderList />
          </DataErrorBoundary>
        </section>
      </div>
    </main>
  );
}
