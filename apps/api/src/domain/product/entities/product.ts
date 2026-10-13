import type { Sku } from "#api/domain/shared/value-objects/sku.ts";
import type { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import type { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";
import { InvalidProductError } from "#api/domain/product/errors/invalid-product-error.ts";
import { isNonEmptyString, isTimestamp } from "#api/domain/shared/validation.ts";

export const PRODUCT_IMAGE_MAX_COUNT = 20;

export type ProductImageSnapshot = Readonly<{
  id: string;
  key: string;
  createdAt: string;
}>;

export type ProductSnapshot = Readonly<{
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  unitPrice: number;
  imageKey: string | null;
  images: readonly ProductImageSnapshot[];
  createdAt: string;
}>;

export type ProductRestoration = Omit<ProductSnapshot, "sku" | "name" | "unitPrice"> &
  Readonly<{ sku: Sku; name: ProductName; unitPrice: UnitPrice }>;

export class Product {
  readonly id: string;
  readonly tenantId: string;
  readonly sku: Sku;
  readonly name: ProductName;
  readonly unitPrice: UnitPrice;
  readonly imageKey: string | null;
  readonly images: readonly ProductImageSnapshot[];
  readonly createdAt: string;

  private constructor(value: ProductRestoration) {
    const images = Object.freeze(
      value.images.map((image) => Object.freeze({ ...image })).sort(compareImages),
    );
    if (
      images.length > PRODUCT_IMAGE_MAX_COUNT ||
      new Set(images.map((image) => image.id)).size !== images.length ||
      new Set(images.map((image) => image.key)).size !== images.length ||
      (value.imageKey !== null && !images.some((image) => image.key === value.imageKey)) ||
      (images.length > 0 && value.imageKey === null)
    ) {
      throw new InvalidProductError("商品の画像参照が不正です");
    }

    this.id = value.id;
    this.tenantId = value.tenantId;
    this.sku = value.sku;
    this.name = value.name;
    this.unitPrice = value.unitPrice;
    this.imageKey = value.imageKey;
    this.images = images;
    this.createdAt = value.createdAt;
    Object.freeze(this);
  }

  static restore(value: ProductRestoration): Product {
    return new Product(value);
  }

  static create(
    input: Pick<ProductRestoration, "tenantId" | "sku" | "name" | "unitPrice">,
  ): Product {
    if (!isNonEmptyString(input.tenantId)) {
      throw new InvalidProductError("商品のテナントが不正です");
    }

    return new Product({
      ...input,
      id: crypto.randomUUID(),
      imageKey: null,
      images: [],
      createdAt: new Date().toISOString(),
    });
  }

  /** SKU・画像参照を保持して、検証済みの基本情報だけを変更する。 */
  updateDetails(input: Pick<ProductRestoration, "name" | "unitPrice">): Product {
    return new Product({ ...this.toSnapshot(), sku: this.sku, ...input });
  }

  /** 既存の代表画像を保ち、最初の画像だけを代表にする。 */
  addImage(image: ProductImageSnapshot): Product {
    this.assertNewImage(image);
    if (this.images.length >= PRODUCT_IMAGE_MAX_COUNT) {
      throw new InvalidProductError(`商品画像は${PRODUCT_IMAGE_MAX_COUNT}件までです`);
    }

    return this.withImages([...this.images, image], this.imageKey ?? image.key);
  }

  /** 代表画像だけを差し替えるので、上限に達していても他の画像を失わない。 */
  replaceImage(image: ProductImageSnapshot): Product {
    this.assertNewImage(image);
    return this.withImages(
      [...this.images.filter((current) => current.key !== this.imageKey), image],
      image.key,
    );
  }

  removeImage(imageId: string): Product {
    const images = this.images.filter((image) => image.id !== imageId);
    if (images.length === this.images.length) {
      return this;
    }

    const primary = images.some((image) => image.key === this.imageKey)
      ? this.imageKey
      : (images[0]?.key ?? null);
    return this.withImages(images, primary);
  }

  private assertNewImage(image: ProductImageSnapshot) {
    // 画像の識別子・日時はブランド型でないため、保存後も同じ値で復元できることを確認する。
    if (
      !isNonEmptyString(image.id) ||
      !isNonEmptyString(image.key) ||
      !isTimestamp(image.createdAt)
    ) {
      throw new InvalidProductError("商品画像の識別情報・日時が不正です");
    }

    if (this.images.some((current) => current.id === image.id || current.key === image.key)) {
      throw new InvalidProductError("商品画像は再利用できません");
    }
  }

  private withImages(images: readonly ProductImageSnapshot[], imageKey: string | null): Product {
    return new Product({
      ...this.toSnapshot(),
      sku: this.sku,
      name: this.name,
      unitPrice: this.unitPrice,
      images,
      imageKey,
    });
  }

  /** 通信・保存用のプリミティブ型を公開し、Entityの操作は渡さない。 */
  toSnapshot(): ProductSnapshot {
    return {
      id: this.id,
      tenantId: this.tenantId,
      sku: this.sku,
      name: this.name,
      unitPrice: this.unitPrice,
      imageKey: this.imageKey,
      images: this.images,
      createdAt: this.createdAt,
    };
  }
}

function compareImages(left: ProductImageSnapshot, right: ProductImageSnapshot) {
  const sameTimestamp = left.createdAt === right.createdAt;
  const leftOrder = sameTimestamp ? left.id : left.createdAt;
  const rightOrder = sameTimestamp ? right.id : right.createdAt;
  return leftOrder < rightOrder ? -1 : Number(leftOrder > rightOrder);
}
