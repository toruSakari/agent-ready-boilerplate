import { z } from "zod";
import { orderLinesSchema } from "#client/entities/order";

export const orderEditSchema = z.object({ lines: orderLinesSchema });

export type OrderEditValues = z.infer<typeof orderEditSchema>;
