import { t as translate } from "#client/shared/i18n";

export function NotFound() {
  return (
    <main className="mx-auto grid max-w-md gap-4 p-6 text-foreground">
      <h1 className="text-2xl font-bold">{translate("ページが見つかりません")}</h1>
      <p>{translate("URLを確認するか、ホームから利用するページを選んでください。")}</p>
      <a href="/" className="underline">
        {translate("ホームへ")}
      </a>
    </main>
  );
}
