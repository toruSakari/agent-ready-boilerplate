import { z } from "zod";
import { pageCursorSchema } from "#api/application/shared/dto-schemas.ts";

export const storePageDtoSchema = <S extends z.ZodType>(item: S) =>
  z.object({ items: z.array(item), nextCursor: pageCursorSchema.nullable() });

export const StorePageDto = <S extends z.ZodType>(item: S) =>
  storePageDtoSchema(item).brand<"StorePageDto">();

export type StorePageDto<T> = z.output<ReturnType<typeof StorePageDto<z.ZodType<T>>>>;
