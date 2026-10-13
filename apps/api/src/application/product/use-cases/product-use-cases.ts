import { ProductListOutputDto } from "#api/application/product/dtos/product-list-output-dto.ts";
import { ProductGetOutputDto } from "#api/application/product/dtos/product-get-output-dto.ts";
import { ProductUpdateOutputDto } from "#api/application/product/dtos/product-update-output-dto.ts";
import { ProductUploadImageOutputDto } from "#api/application/product/dtos/product-upload-image-output-dto.ts";
import { ProductAddImageOutputDto } from "#api/application/product/dtos/product-add-image-output-dto.ts";
import { ProductDeleteImageOutputDto } from "#api/application/product/dtos/product-delete-image-output-dto.ts";
import { ProductGetImageOutputDto } from "#api/application/product/dtos/product-get-image-output-dto.ts";
import type { ProductListInputDto } from "#api/application/product/dtos/product-list-input-dto.ts";
import type { ProductGetInputDto } from "#api/application/product/dtos/product-get-input-dto.ts";
import type { ProductUpdateInputDto } from "#api/application/product/dtos/product-update-input-dto.ts";
import type { ProductUploadImageInputDto } from "#api/application/product/dtos/product-upload-image-input-dto.ts";
import type { ProductAddImageInputDto } from "#api/application/product/dtos/product-add-image-input-dto.ts";
import type { ProductDeleteImageInputDto } from "#api/application/product/dtos/product-delete-image-input-dto.ts";
import type { ProductGetImageInputDto } from "#api/application/product/dtos/product-get-image-input-dto.ts";
import type { ProductImageStore } from "#api/application/product/storage/product-image-store.ts";
import { pageRequest } from "#api/application/shared/pagination.ts";
import type { AuthorizedActor } from "#api/application/auth/contracts/authorized-actor.ts";
import {
  IMAGE_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MEBIBYTES,
  IMAGE_RETENTION_MS,
} from "#api/application/product/policies/image-policy.ts";
import { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { InvalidProductError } from "#api/domain/product/errors/invalid-product-error.ts";
import type { ProductRepository } from "#api/domain/product/repositories/product-repository.ts";
import type { ProductImageStorage } from "#api/application/product/storage/product-image-storage.ts";

const PNG_SIGNATURE = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10]);
const JPEG_SIGNATURE = Object.freeze([255, 216, 255]);
const RIFF_HEADER_LENGTH = 4;
const WEBP_FORMAT_OFFSET = 8;
const WEBP_FORMAT_LENGTH = 4;
const WEBP_HEADER_LENGTH = WEBP_FORMAT_OFFSET + WEBP_FORMAT_LENGTH;

function hasWebpSignature(b: Uint8Array) {
  return (
    b.length >= WEBP_HEADER_LENGTH &&
    String.fromCharCode(...b.slice(0, RIFF_HEADER_LENGTH)) === "RIFF" &&
    String.fromCharCode(...b.slice(WEBP_FORMAT_OFFSET, WEBP_HEADER_LENGTH)) === "WEBP"
  );
}

// 申告されたMIMEだけを信用せず先頭シグネチャも照合する。画像全体のデコード検証ではない。
function validateImage(bytes: ArrayBuffer, contentType: string) {
  const b = new Uint8Array(bytes);
  const png = PNG_SIGNATURE.every((v, i) => b[i] === v);
  const jpeg = JPEG_SIGNATURE.every((value, index) => b[index] === value);
  const webp = hasWebpSignature(b);
  if (
    !b.length ||
    b.length > MAX_IMAGE_BYTES ||
    !(
      (contentType === IMAGE_CONTENT_TYPES.png && png) ||
      (contentType === IMAGE_CONTENT_TYPES.jpeg && jpeg) ||
      (contentType === IMAGE_CONTENT_TYPES.webp && webp)
    )
  ) {
    throw new ApplicationError({
      code: "BAD_REQUEST",
      message: `${MAX_IMAGE_MEBIBYTES}MB以下のPNG・JPEG・WebP画像を選んでください`,
    });
  }
}

export class ProductUseCases {
  constructor(
    private readonly products: ProductRepository,
    private readonly images: ProductImageStorage,
    private readonly imageStore: ProductImageStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(inputDto: ProductListInputDto): Promise<ProductListOutputDto> {
    const { identity, page, filters } = inputDto;
    return ProductListOutputDto.parse({
      items: (await this.products.list(identity.tenantId, pageRequest(page), filters)).map(
        (product) => product.toSnapshot(),
      ),
    });
  }

  async get(inputDto: ProductGetInputDto): Promise<ProductGetOutputDto> {
    const { identity, id } = inputDto;
    return ProductGetOutputDto.parse((await this.find(identity, id)).toSnapshot());
  }

  async update(inputDto: ProductUpdateInputDto): Promise<ProductUpdateOutputDto> {
    const { identity, input } = inputDto;
    const current = await this.find(identity, input.id);
    let next;
    try {
      next = current.updateDetails({
        name: ProductName.create(input.name.trim()),
        unitPrice: UnitPrice.create(input.unitPrice),
      });
    } catch (error) {
      if (error instanceof InvalidValueObjectError || error instanceof InvalidProductError) {
        throw new ApplicationError({ code: "BAD_REQUEST", message: error.message });
      }

      throw error;
    }

    if (
      !(await this.products.updateDetails(next, {
        name: input.expectedName,
        unitPrice: input.expectedUnitPrice,
      }))
    ) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "商品が更新されています。再読み込みしてください",
      });
    }

    return ProductUpdateOutputDto.parse(next.toSnapshot());
  }

  private async find(identity: AuthorizedActor, id: string) {
    const product = await this.products.find(identity.tenantId, id);
    if (!product) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    }

    return product;
  }

  async uploadImage(inputDto: ProductUploadImageInputDto): Promise<ProductUploadImageOutputDto> {
    const { identity, id, bytes, contentType } = inputDto;
    return ProductUploadImageOutputDto.parse(
      await this.storeImage(identity, id, bytes, contentType, true),
    );
  }

  async addImage(inputDto: ProductAddImageInputDto): Promise<ProductAddImageOutputDto> {
    const { identity, id, bytes, contentType } = inputDto;
    return ProductAddImageOutputDto.parse(
      await this.storeImage(identity, id, bytes, contentType, false),
    );
  }

  private async storeImage(
    identity: AuthorizedActor,
    id: string,
    bytes: ArrayBuffer,
    contentType: string,
    replace: boolean,
  ) {
    const product = await this.find(identity, id);
    validateImage(bytes, contentType);
    const imageId = crypto.randomUUID();
    const now = this.clock();
    const image = {
      id: imageId,
      key: `products/${encodeURIComponent(identity.tenantId)}/${id}/${imageId}`,
      createdAt: now.toISOString(),
    };
    let next;
    try {
      next = replace ? product.replaceImage(image) : product.addImage(image);
    } catch (error) {
      if (error instanceof InvalidProductError) {
        throw new ApplicationError({ code: "CONFLICT", message: error.message });
      }

      throw error;
    }

    // R2への書込み前に回収可能な記録を残す。D1の結果が不明でも参照は保存済みかもしれないため、
    // リクエスト内の補償削除はせず、保持期限と参照を確認する後日の清掃へ任せる。
    await this.imageStore.stageImage({
      tenantId: identity.tenantId,
      productId: id,
      image,
      deleteAfter: new Date(now.getTime() + IMAGE_RETENTION_MS).toISOString(),
    });
    await this.images.put(image.key, bytes, contentType);
    const attachedAt = this.clock();
    const updated = await this.products.attachImage(next, imageId, {
      expectedKey: product.imageKey,
      now: attachedAt.toISOString(),
      deleteAfter: new Date(attachedAt.getTime() + IMAGE_RETENTION_MS).toISOString(),
    });
    if (!updated) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "画像が更新されました。再読み込みしてください",
      });
    }

    return image;
  }

  async deleteImage(inputDto: ProductDeleteImageInputDto): Promise<ProductDeleteImageOutputDto> {
    const { identity, id, imageId } = inputDto;
    const product = await this.find(identity, id);
    const image =
      imageId === undefined
        ? product.images.find((value) => value.key === product.imageKey)
        : product.images.find((value) => value.id === imageId);
    // 再削除は成功扱いにする。削除対象のキーは呼出元から受け取らず、この商品の参照で決める。
    if (!image) {
      return ProductDeleteImageOutputDto.parse({ ok: true });
    }

    const now = this.clock();
    const updated = await this.products.removeImage(product.removeImage(image.id), image.id, {
      expectedKey: product.imageKey,
      now: now.toISOString(),
      deleteAfter: new Date(now.getTime() + IMAGE_RETENTION_MS).toISOString(),
    });
    if (!updated) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "画像が更新されました。再読み込みしてください",
      });
    }

    return ProductDeleteImageOutputDto.parse({ ok: true });
  }

  async getImage(inputDto: ProductGetImageInputDto): Promise<ProductGetImageOutputDto> {
    const { identity, id, imageId } = inputDto;
    const product = await this.find(identity, id);
    const reference =
      imageId === undefined
        ? product.images.find((value) => value.key === product.imageKey)
        : product.images.find((value) => value.id === imageId);
    if (!reference) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "商品画像が見つかりません" });
    }

    // 商品のテナントと有効な画像参照を照合してから実体を取得し、任意キーの読取りを許さない。
    const image = await this.images.get(reference.key);
    if (!image) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "商品画像が見つかりません" });
    }

    return ProductGetImageOutputDto.parse(image);
  }
}
