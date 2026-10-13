import { z } from "zod";
import { orderLinesSchema } from "#client/entities/order";

// 作成と下書き編集の制約を共通の明細スキーマへ合わせ、API側でも検証する。
export const orderCreationSchema = z.object({ lines: orderLinesSchema, draft: z.boolean() });

export type OrderCreationValues = z.infer<typeof orderCreationSchema>;
