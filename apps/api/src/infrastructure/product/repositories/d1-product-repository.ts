import type { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { initialStockStatements } from "#api/infrastructure/inventory/shared/initial-stock-statements.ts";
import { productWriteValues } from "#api/infrastructure/product/mappers/product-write-values.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { publicProducts } from "#api/infrastructure/product/shared/public-products.ts";
import { inventoryItems } from "#api/infrastructure/inventory/schemas/schema.ts";
import type { PageRequest } from "#api/domain/shared/page-request.ts";
import type { InventoryFilters, StoreFilters } from "#api/domain/shared/list-filters.ts";
import { pageRequest } from "#api/application/shared/pagination.ts";
import { cursorPagination } from "#api/infrastructure/shared/cursor-pagination.ts";
import { textSearch } from "#api/infrastructure/shared/list-conditions.ts";
import { drizzle } from "drizzle-orm/d1";
import { products, productImages } from "#api/infrastructure/product/schemas/schema.ts";
import { restoreProductRows } from "#api/infrastructure/product/mappers/restore-product-rows.ts";
import { and, asc, eq, inArray, gt, sql } from "drizzle-orm";
import type {
  ProductRepository,
  ProductImageWriteCondition,
} from "#api/domain/product/repositories/product-repository.ts";
import {
  activateStagedImage,
  retireReplacedImage,
  selectPrimaryImage,
} from "#api/infrastructure/product/shared/product-image-attachment.ts";
import {
  retireRemovedImage,
  selectRemainingImage,
} from "#api/infrastructure/product/shared/product-image-removal.ts";
import { productImageAttachmentValues } from "#api/infrastructure/product/mappers/product-image-write-values.ts";
import type { Product } from "#api/domain/product/entities/product.ts";

export class D1ProductRepository implements ProductRepository {
  private readonly database;

  constructor(binding: D1Database) {
    this.database = drizzle(binding);
  }

  async register(product: Product, initialStock: StockQuantity, actorId: string) {
    const row = productWriteValues(product);
    try {
      // 新商品だけの初期化。既存SKUの台帳を上書きせず、D1 batchで全体をロールバックする。
      await this.database.batch([
        this.database.insert(products).values(row),
        ...initialStockStatements(this.database, {
          tenantId: row.tenantId,
          sku: row.sku,
          quantity: initialStock,
          actorId,
          createdAt: row.createdAt,
        }),
      ]);
    } catch (error) {
      const [registered, stock] = await Promise.all([
        this.database
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.tenantId, row.tenantId), eq(products.sku, row.sku)))
          .limit(1),
        this.database
          .select({ sku: inventoryItems.sku })
          .from(inventoryItems)
          .where(and(eq(inventoryItems.tenantId, row.tenantId), eq(inventoryItems.sku, row.sku)))
          .limit(1),
      ]);
      if (registered.length || stock.length) {
        throw new ApplicationError({ code: "CONFLICT", message: "このSKUは登録済みです" });
      }

      throw error;
    }
  }

  listPublic(page: PageRequest, search?: string, filters?: StoreFilters) {
    return publicProducts(this.database, page, search, filters);
  }

  async updateDetails(product: Product, expected: { name: string; unitPrice: number }) {
    const rows = await this.database
      .update(products)
      .set({ name: product.name, unitPrice: product.unitPrice })
      .where(
        and(
          eq(products.id, product.id),
          eq(products.tenantId, product.tenantId),
          eq(products.name, expected.name),
          eq(products.unitPrice, expected.unitPrice),
        ),
      )
      .returning({ id: products.id });
    return rows.length === 1;
  }

  async attachImage(product: Product, imageId: string, condition: ProductImageWriteCondition) {
    const input = productImageAttachmentValues(product, imageId, condition);
    if (!input) {
      return false;
    }

    const { image } = input;
    const mutationId = crypto.randomUUID();
    // 配列全体は書き戻さず、Entityから得た画像と代表参照の差分だけを同じbatchで保存する。
    const [rows] = await this.database.batch([
      activateStagedImage(this.database, input, mutationId),
      retireReplacedImage(this.database, input, mutationId),
      selectPrimaryImage(this.database, input, mutationId),
    ]);
    if (rows.length === 1) {
      return true;
    }

    // 再試行は既存の関連付けだけを確認し、別の代表画像変更へ転用しない。
    const [active] = await this.database
      .select({ id: productImages.id })
      .from(productImages)
      .where(
        and(
          eq(productImages.id, image.id),
          eq(productImages.key, image.key),
          eq(productImages.createdAt, image.createdAt),
          eq(productImages.tenantId, product.tenantId),
          eq(productImages.productsId, product.id),
          eq(productImages.state, "active"),
        ),
      )
      .limit(1);
    return !!active;
  }

  async removeImage(product: Product, imageId: string, condition: ProductImageWriteCondition) {
    if (product.images.some((image) => image.id === imageId)) {
      return false;
    }

    const input = {
      ...condition,
      tenantId: product.tenantId,
      productId: product.id,
      imageId,
      imageKey: product.imageKey,
    };
    const mutationId = crypto.randomUUID();
    const [rows] = await this.database.batch([
      retireRemovedImage(this.database, input, mutationId),
      selectRemainingImage(this.database, input, mutationId),
    ]);
    return rows.length === 1;
  }

  async find(tenantId: string, id: string): Promise<Product | null> {
    const rows = await this.database
      .select({ product: products, image: productImages })
      .from(products)
      .leftJoin(
        productImages,
        and(
          eq(productImages.productsId, products.id),
          eq(productImages.tenantId, products.tenantId),
          eq(productImages.state, "active"),
        ),
      )
      .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
      .orderBy(asc(productImages.createdAt), asc(productImages.id));
    return restoreProductRows(rows)[0] ?? null;
  }

  async findBySkus(tenantId: string, skus: readonly string[]): Promise<Product[]> {
    if (!skus.length) {
      return [];
    }

    const rows = await this.database
      .select({ product: products, image: productImages })
      .from(products)
      .leftJoin(
        productImages,
        and(
          eq(productImages.productsId, products.id),
          eq(productImages.tenantId, products.tenantId),
          eq(productImages.state, "active"),
        ),
      )
      .where(and(eq(products.tenantId, tenantId), inArray(products.sku, [...new Set(skus)])))
      .orderBy(asc(productImages.createdAt), asc(productImages.id));
    return restoreProductRows(rows);
  }

  async list(tenantId: string, page?: PageRequest, filters: InventoryFilters = {}) {
    const pagination = pageRequest(page);
    const cursor = cursorPagination(products, pagination.cursor, filters.sort);
    // 結合行数でLIMITすると一商品の画像が欠けるため、先に商品IDだけをページングする。
    const ids = this.database
      .select({ id: products.id })
      .from(products)
      .leftJoin(
        inventoryItems,
        and(eq(inventoryItems.tenantId, products.tenantId), eq(inventoryItems.sku, products.sku)),
      )
      .where(
        and(
          eq(products.tenantId, tenantId),
          cursor.after,
          textSearch([products.name, products.sku], filters.search),
          filters.stock === "in-stock" ? gt(inventoryItems.onHand, 0) : undefined,
          filters.stock === "out-of-stock"
            ? sql`coalesce(${inventoryItems.onHand}, 0) = 0`
            : undefined,
        ),
      )
      .orderBy(...cursor.order)
      .limit(pagination.limit);
    const rows = await this.database
      .select({ product: products, image: productImages })
      .from(products)
      .leftJoin(
        productImages,
        and(
          eq(productImages.productsId, products.id),
          eq(productImages.tenantId, products.tenantId),
          eq(productImages.state, "active"),
        ),
      )
      .where(and(eq(products.tenantId, tenantId), inArray(products.id, ids)))
      .orderBy(...cursor.order, asc(productImages.createdAt), asc(productImages.id));
    return restoreProductRows(rows);
  }
}
