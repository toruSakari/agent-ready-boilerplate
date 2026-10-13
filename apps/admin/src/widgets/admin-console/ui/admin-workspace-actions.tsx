import { t as translate } from "@dev-template/client/i18n";
import { Link } from "@tanstack/react-router";
import { Card } from "@dev-template/ui/card";
import { Button } from "@dev-template/ui/button";

const actions = [
  {
    title: "企業管理",
    description: "企業の作成、利用状態、メンバーとIP制限を管理します。",
    to: "/organizations",
  },
  {
    title: "ユーザー管理",
    description: "サービス登録と企業への所属を管理します。",
    to: "/users",
  },
  {
    title: "運営メンバー・権限",
    description: "運営メンバーの招待とロール、監査履歴を確認します。",
    to: "/access",
  },
];

export function AdminWorkspaceActions() {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {actions.map((item) => (
        <Card key={item.to} className="flex flex-col gap-4 p-6">
          <h2 className="text-lg font-semibold">{translate(item.title)}</h2>
          <p className="flex-1 text-sm leading-6 text-muted-foreground">
            {translate(item.description)}
          </p>
          <Button variant="outline" asChild>
            <Link to={item.to}>{translate("管理画面を開く")}</Link>
          </Button>
        </Card>
      ))}
    </section>
  );
}
