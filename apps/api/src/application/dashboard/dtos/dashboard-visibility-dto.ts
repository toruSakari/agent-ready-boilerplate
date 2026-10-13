import { z } from "zod";

export const dashboardVisibilityDtoSchema = z.object({
  orders: z.boolean(),
  products: z.boolean(),
  members: z.boolean(),
});

export const DashboardVisibilityDto = dashboardVisibilityDtoSchema
  .brand<"DashboardVisibilityDto">()
  .readonly();

export type DashboardVisibilityDto = z.infer<typeof DashboardVisibilityDto>;
