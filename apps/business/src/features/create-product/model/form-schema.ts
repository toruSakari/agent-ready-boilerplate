import { productInputSchema } from "#business/entities/product/index.ts";
import { stockInputSchema } from "#business/entities/inventory/index.ts";

export const createProductSchema = productInputSchema.extend({ initialStock: stockInputSchema });
