import { CustomerOrderReceipt, useCustomerOrder } from "#web/entities/customer-order/index.ts";
import { Link } from "@tanstack/react-router";
import { t } from "@dev-template/client/i18n";
import { CancelOrder } from "#web/features/cancel-order/index.ts";
import { Button } from "@dev-template/ui/button";

export function CustomerOrderDetail(props: { id: string; complete?: boolean }) {
  const { id, complete = false } = props;

  const { data: order } = useCustomerOrder(id);
  return (
    <div className="mx-auto max-w-4xl">
      {complete ? (
        <div className="mb-8 rounded-xl bg-success/10 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success text-2xl text-hero-foreground">
            ✓
          </div>
          <h1 className="text-3xl font-bold text-success">{t("ご注文ありがとうございます")}</h1>
          <p className="mt-3 text-sm text-success">
            {t("注文を受け付けました。注文履歴から状況を確認できます。")}
          </p>
        </div>
      ) : (
        <h1 className="mb-8 text-3xl font-bold">{t("注文詳細")}</h1>
      )}
      <CustomerOrderReceipt order={order} />
      {!complete && (
        <div className="mt-6 flex justify-end">
          <CancelOrder order={order} />
        </div>
      )}
      <div className="mt-8 flex justify-center gap-4">
        <Button asChild variant="outline">
          <Link to="/orders">{t("注文履歴へ")}</Link>
        </Button>
        <Button asChild>
          <Link to="/">{t("お買い物を続ける")}</Link>
        </Button>
      </div>
    </div>
  );
}
