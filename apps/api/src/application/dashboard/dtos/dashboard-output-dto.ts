import type { z } from "zod";
import { dashboardSummaryDtoSchema } from "#api/application/dashboard/dtos/dashboard-summary-dto.ts";

export const dashboardOutputDtoSchema = dashboardSummaryDtoSchema;

export const DashboardOutputDto = dashboardOutputDtoSchema.brand<"DashboardOutputDto">().readonly();

export type DashboardOutputDto = z.infer<typeof DashboardOutputDto>;
