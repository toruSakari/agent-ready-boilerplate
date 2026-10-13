import { t as translate } from "#client/shared/i18n";
import { Button } from "@dev-template/ui/button";
import type { useOrders } from "#client/entities/order";

export function OrderPagination(props: { orders: ReturnType<typeof useOrders> }) {
  return (
    <div
      className="flex items-center justify-between px-6 py-3"
      aria-label={translate("注文のページ切替")}
    >
      <Button
        variant="outline"
        disabled={props.orders.page === 0 || props.orders.isFetching}
        onClick={props.orders.previousPage}
      >
        {translate("前へ")}
      </Button>
      <span>
        {props.orders.page + 1}
        {translate("ページ")}
      </span>
      <Button
        variant="outline"
        disabled={!props.orders.hasNextPage || props.orders.isFetching}
        onClick={props.orders.nextPage}
      >
        {translate("次へ")}
      </Button>
    </div>
  );
}
