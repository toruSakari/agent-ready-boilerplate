import { t as translate, errorMessage } from "#client/shared/i18n";
import { Alert, AlertDescription } from "@dev-template/ui/alert";
import { Button } from "@dev-template/ui/button";
import type { useOrderEditor } from "#client/features/manage-order/model/use-order-editor";

export function OrderMutationFeedback(props: { editor: ReturnType<typeof useOrderEditor> }) {
  const { pending, error } = props.editor;
  return (
    <>
      {" "}
      {pending ? <p role="status">{translate("注文を更新しています…")}</p> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      ) : null}
      {error?.data?.code === "CONFLICT" ? (
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
          {translate("最新の注文を読み込む")}
        </Button>
      ) : null}
    </>
  );
}
