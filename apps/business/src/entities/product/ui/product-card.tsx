import { formatMoney } from "@dev-template/client/i18n";
import type { ReactNode } from "react";
import type { Product } from "#business/entities/product/model/product.ts";
import { Card } from "@dev-template/ui/card";

/** 登録・画像編集などの操作UIはchildrenで受け取り、商品entityからfeatureへ逆依存しない。 */
export function ProductCard(props: { product: Product; children?: ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">{props.product.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {props.product.sku} · {formatMoney(props.product.unitPrice)}
      </p>
      {props.children}
    </Card>
  );
}
