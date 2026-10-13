import { Link } from "@tanstack/react-router";
import { t as translate } from "@dev-template/client/i18n";
import { Button } from "@dev-template/ui/button";
import { ThemeMenu } from "@dev-template/client/theme";

export function AdminHeader(props: { open: boolean; onToggle: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 bg-hero px-5 text-hero-foreground shadow-sm">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          className="text-hero-foreground md:hidden"
          aria-expanded={props.open}
          aria-label={translate("ナビゲーションを開く")}
          onClick={() => props.onToggle()}
        >
          ☰
        </Button>
        <Link to="/" className="font-bold tracking-wide">
          {translate("運営コンソール")}
        </Link>
        <span className="hidden rounded bg-hero-surface px-2 py-1 text-xs sm:block">
          {translate("管理者")}
        </span>
      </div>
      <div className="text-foreground">
        <ThemeMenu />
      </div>
    </header>
  );
}
