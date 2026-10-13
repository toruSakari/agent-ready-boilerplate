import { t as translate, formatMoney } from "@dev-template/client/i18n";
import { Link } from "@tanstack/react-router";
import { Button } from "@dev-template/ui/button";
import type { Product } from "#business/entities/product/index.ts";

export function ProductRow(props: { product: Product; organizationId: string }) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="p-4 font-medium">{props.product.name}</td>
      <td className="p-4 font-mono text-muted-foreground">{props.product.sku}</td>
      <td className="p-4 font-semibold">{formatMoney(props.product.unitPrice)}</td>
      <td className="p-4 text-muted-foreground">
        {translate("{{count}}枚", { count: props.product.images.length })}
      </td>
      <td className="p-4">
        <Button asChild variant="outline" size="sm">
          <Link
            to="/organizations/$organizationId/products/$productId"
            params={{ organizationId: props.organizationId, productId: props.product.id }}
          >
            {translate("詳細を見る")}
          </Link>
        </Button>
      </td>
    </tr>
  );
}
