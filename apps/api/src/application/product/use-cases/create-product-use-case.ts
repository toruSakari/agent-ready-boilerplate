import { Product } from "#api/domain/product/entities/product.ts";
import { CreateProductOutputDto } from "#api/application/product/dtos/create-product-output-dto.ts";
import type { CreateProductInputDto } from "#api/application/product/dtos/create-product-input-dto.ts";
import type { AuthorizedActor } from "#api/application/auth/contracts/authorized-actor.ts";
import {
  DEFAULT_INITIAL_STOCK,
  CreateProductInput,
} from "#api/application/product/dtos/create-product-input.ts";
import type { ProductRepository } from "#api/domain/product/repositories/product-repository.ts";

import { InvalidProductError } from "#api/domain/product/errors/invalid-product-error.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

export class CreateProductUseCase {
  constructor(private readonly registration: Pick<ProductRepository, "register">) {}

  async execute(inputDto: CreateProductInputDto): Promise<CreateProductOutputDto> {
    const { actor, input } = inputDto;
    const { product, initialStock } = this.validate(actor, input);
    await this.registration.register(product, initialStock, actor.userId);
    return CreateProductOutputDto.parse(product.toSnapshot());
  }

  private validate(actor: AuthorizedActor, input: CreateProductInput) {
    try {
      return {
        product: Product.create({
          tenantId: actor.tenantId,
          sku: Sku.create(input.sku.trim()),
          name: ProductName.create(input.name.trim()),
          unitPrice: UnitPrice.create(input.unitPrice),
        }),
        initialStock: StockQuantity.create(input.initialStock ?? DEFAULT_INITIAL_STOCK),
      };
    } catch (error) {
      if (error instanceof InvalidProductError || error instanceof InvalidValueObjectError) {
        throw new ApplicationError({ code: "BAD_REQUEST", message: error.message });
      }

      throw error;
    }
  }
}
