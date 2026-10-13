import { z } from "zod";
import type { PageRequest } from "#api/domain/shared/page-request.ts";

export const PAGE_LIMITS = Object.freeze({ defaultSize: 25, maxSize: 100, maxCursorIdLength: 128 });
const cursorSchema = z
  .object({
    createdAt: z.union([z.iso.datetime({ offset: true }), z.iso.date()]),
    id: z.string().min(1).max(PAGE_LIMITS.maxCursorIdLength),
  })
  .strict();
export const paginationSchema = z
  .object({
    limit: z.number().int().min(1).max(PAGE_LIMITS.maxSize).default(PAGE_LIMITS.defaultSize),
    cursor: cursorSchema.optional(),
  })
  .strict();

export function pageRequest(value?: Partial<PageRequest>): PageRequest {
  return paginationSchema.parse(value ?? {});
}
