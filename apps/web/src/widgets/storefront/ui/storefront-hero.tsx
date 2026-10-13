import { t } from "@dev-template/client/i18n";

export function StorefrontHero() {
  return (
    <section className="relative mb-9 overflow-hidden rounded-2xl bg-hero px-7 py-10 text-hero-foreground md:px-12 md:py-14">
      <p className="text-xs font-bold tracking-[0.2em] text-hero-accent">
        {t("毎日に、ちょうどいい発見。")}
      </p>
      <h1 className="mt-4 max-w-3xl text-balance text-3xl font-bold leading-snug md:text-5xl">
        {t("探していたものに、出会おう。")}
      </h1>
      <p className="mt-5 max-w-lg text-sm leading-7 text-hero-muted">
        {t("お気に入りの商品を見つけて、カートへ。お買い物をもっとシンプルに。")}
      </p>
      <div
        aria-hidden="true"
        className="absolute -right-12 -top-12 h-80 w-80 rounded-full border-[40px] border-hero-border"
      />
    </section>
  );
}
