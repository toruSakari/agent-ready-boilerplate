import type { z } from "zod";
import type { ProductGetInputDto } from "#api/application/product/dtos/product-get-input-dto.ts";
import type { ProductGetOutputDto } from "#api/application/product/dtos/product-get-output-dto.ts";
import type { ProductDeleteImageInputDto } from "#api/application/product/dtos/product-delete-image-input-dto.ts";
import type { ProductGetImageInputDto } from "#api/application/product/dtos/product-get-image-input-dto.ts";
import type { ManageStockGetOutputDto } from "#api/application/inventory/dtos/manage-stock-get-output-dto.ts";
import type { ManageStockChangeOutputDto } from "#api/application/inventory/dtos/manage-stock-change-output-dto.ts";
import type { OrderSnapshot } from "#api/domain/order/entities/order.ts";
import type { CreateOrderOutputDto } from "#api/application/order/dtos/create-order-output-dto.ts";

type Assert<T extends true> = T;

type NotAssignable<From, To> = [From] extends [To] ? false : true;

export type RawInputIsRejected = Assert<
  NotAssignable<z.input<typeof ProductGetInputDto>, ProductGetInputDto>
>;

export type RawOutputIsRejected = Assert<
  NotAssignable<z.input<typeof ProductGetOutputDto>, ProductGetOutputDto>
>;

export type IdenticalInputFieldsHaveDifferentBrands = Assert<
  NotAssignable<ProductDeleteImageInputDto, ProductGetImageInputDto>
>;

export type IdenticalOutputFieldsHaveDifferentBrands = Assert<
  NotAssignable<ManageStockGetOutputDto, ManageStockChangeOutputDto>
>;

export type DomainSnapshotIsNotAnOutputDto = Assert<
  NotAssignable<OrderSnapshot, CreateOrderOutputDto>
>;

export type StockFieldRemainsPrimitive = Assert<
  ManageStockGetOutputDto["onHand"] extends number ? true : false
>;
