import { BusinessHeader } from "#business/widgets/business-shell/ui/business-header.tsx";
import type { ReactNode } from "react";
import { t as translate } from "@dev-template/client/i18n";
import { BusinessNavigation } from "#business/widgets/business-navigation/index.ts";

/** 販売業務の共通ナビゲーションとコンテンツ枠。ページ固有の取得・操作は子が所有する。 */
export function BusinessShell(props: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground dark:bg-background dark:text-foreground">
      <BusinessHeader />
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b bg-card p-4 dark:bg-card lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r">
          <p className="mb-4 hidden px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:block">
            {translate("ワークスペース")}
          </p>
          <BusinessNavigation />
        </aside>
        <main className="min-w-0 p-5 sm:p-8 lg:p-10">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{props.title}</h1>
              {props.description && (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {props.description}
                </p>
              )}
            </div>
            {props.actions}
          </div>
          <div className="space-y-6">{props.children}</div>
        </main>
      </div>
    </div>
  );
}
