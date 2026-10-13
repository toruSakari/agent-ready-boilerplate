import { Link } from "@tanstack/react-router";
import { t as translate } from "@dev-template/client/i18n";
import { ThemeMenu } from "@dev-template/client/theme";
import { Button } from "@dev-template/ui/button";

export function BusinessHeader() {
  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 bg-hero px-5 py-3 text-hero-foreground sm:flex-nowrap sm:py-0">
      <Link to="/" className="w-full text-xl font-bold tracking-tight sm:w-auto">
        market<span className="text-hero-accent">place</span>
        <span className="ml-3 text-xs font-normal text-hero-muted">
          {translate("販売者センター")}
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          className="text-hero-foreground hover:bg-hero-surface hover:text-hero-foreground"
        >
          <Link to="/">{translate("企業を切り替える")}</Link>
        </Button>
        <div className="text-foreground">
          <ThemeMenu />
        </div>
      </div>
    </header>
  );
}
