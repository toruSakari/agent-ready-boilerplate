import { Link } from "@tanstack/react-router";
import { t as translate } from "@dev-template/client/i18n";

const navigation = [
  { to: "/", label: "ダッシュボード" },
  { to: "/organizations", label: "企業管理" },
  { to: "/users", label: "ユーザー管理" },
  { to: "/access", label: "運営メンバー" },
  { to: "/roles", label: "ロール・権限" },
  { to: "/audit", label: "監査ログ" },
  { to: "/account", label: "アカウント設定" },
];

export function AdminSidebar(props: { open: boolean; onClose: () => void }) {
  return (
    <aside
      className={`${props.open ? "block" : "hidden"} fixed inset-x-0 top-16 z-20 border-b bg-hero p-5 text-hero-foreground md:sticky md:top-16 md:block md:h-[calc(100vh-4rem)] md:w-60 md:shrink-0 md:border-b-0`}
    >
      <p className="mb-4 px-3 text-xs font-semibold tracking-widest text-hero-muted">
        {translate("ワークスペース")}
      </p>
      <nav className="grid gap-2" aria-label={translate("運営ナビゲーション")}>
        {navigation.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            activeProps={{
              className: "bg-hero-accent border-l-2 border-primary text-hero-accent-foreground",
            }}
            className="rounded-md px-3 py-3 text-sm font-medium transition hover:bg-hero-surface"
            onClick={() => props.onClose()}
          >
            {translate(item.label)}
          </Link>
        ))}
      </nav>
      <p className="mt-10 px-3 text-xs leading-6 text-hero-muted">
        {translate("企業とユーザーの運営管理")}
      </p>
    </aside>
  );
}
