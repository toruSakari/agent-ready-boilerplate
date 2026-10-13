import { t as translate } from "#client/shared/i18n";
import type { ReactNode } from "react";
import { Button } from "@dev-template/ui/button";

// 登録情報・退会の枠は業務セッションを読まない。未登録でも表示できるようデータ取得を持たせない。
export function AccountLayout(props: {
  title: string;
  headerAction: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid max-w-xl gap-6 p-6 text-foreground">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{props.title}</h1>
        {props.headerAction}
      </header>
      <Button asChild variant="outline">
        <a href="/">{translate("ホームへ")}</a>
      </Button>
      {props.children}
    </main>
  );
}
