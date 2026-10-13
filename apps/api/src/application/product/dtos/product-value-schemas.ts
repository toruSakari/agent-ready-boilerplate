import { z } from "zod";

export const productImageSchema = z
  .object({ id: z.string(), key: z.string(), createdAt: z.string() })
  .readonly();
export const productSnapshotSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    sku: z.string(),
    name: z.string(),
    unitPrice: z.number(),
    imageKey: z.string().nullable(),
    images: z.array(productImageSchema).readonly(),
    createdAt: z.string(),
  })
  .readonly();
export const storedImageSchema = z.object({
  body: z.instanceof(ReadableStream),
  contentType: z.string(),
  etag: z.string(),
});
