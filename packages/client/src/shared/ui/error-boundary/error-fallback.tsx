import { t as translate } from "#client/shared/i18n";
import { ROUTE_ACCESS_ERRORS } from "#client/shared/config/access-errors";
import { Alert, AlertDescription } from "@dev-template/ui/alert";
import { Button } from "@dev-template/ui/button";
import { isForbiddenQueryError } from "#client/shared/api/query-access";

/** 内部例外のメッセージは公開せず、利用者が再試行できる表示にする。 */
export function ErrorFallback(props: { error: unknown; reset: () => void }) {
  const message = props.error instanceof Error ? props.error.message : undefined;
  const forbidden = isForbiddenQueryError(props.error) || message === ROUTE_ACCESS_ERRORS.forbidden;
  const access = message === ROUTE_ACCESS_ERRORS.unavailable;
  let title;
  if (forbidden) {
    title = translate("この画面を利用する権限がありません");
  } else {
    if (access) {
      title = translate("利用資格を確認できませんでした");
    } else {
      title = translate("画面を表示できませんでした");
    }
  }

  return (
    <section className="mx-auto grid max-w-md gap-4 p-6 text-foreground">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Alert variant="destructive">
        <AlertDescription>
          {forbidden
            ? translate(
                "ログイン中のアカウント・所属では利用できません。管理者に確認してください。",
              )
            : translate("通信状況を確認して、もう一度お試しください。")}
        </AlertDescription>
      </Alert>
      <Button onClick={props.reset}>{translate("もう一度確認")}</Button>
    </section>
  );
}
