import { z } from "zod";

export const dashboardSummaryDtoSchema = z.object({
  ordersTotal: z.union([z.number(), z.null()]),
  draftCount: z.union([z.number(), z.null()]),
  confirmedCount: z.union([z.number(), z.null()]),
  productsTotal: z.union([z.number(), z.null()]),
  membersTotal: z.union([z.number(), z.null()]),
});

export const DashboardSummaryDto = dashboardSummaryDtoSchema
  .brand<"DashboardSummaryDto">()
  .readonly();

export type DashboardSummaryDto = z.infer<typeof DashboardSummaryDto>;
