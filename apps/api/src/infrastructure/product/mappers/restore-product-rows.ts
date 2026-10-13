import { restoreStoredProduct } from "#api/infrastructure/product/mappers/restore-stored-product.ts";
import { products, productImages } from "#api/infrastructure/product/schemas/schema.ts";

type ProductRow = typeof products.$inferSelect;

type ImageRow = typeof productImages.$inferSelect;

export function restoreProductRows(rows: { product: ProductRow; image: ImageRow | null }[]) {
  const grouped = new Map<string, { product: ProductRow; images: ImageRow[] }>();
  for (const row of rows) {
    let group = grouped.get(row.product.id);
    if (!group) {
      group = { product: row.product, images: [] };
      grouped.set(row.product.id, group);
    }

    if (row.image) {
      group.images.push(row.image);
    }
  }

  return [...grouped.values()].map((props) =>
    restoreStoredProduct({ ...props.product, images: props.images }),
  );
}
