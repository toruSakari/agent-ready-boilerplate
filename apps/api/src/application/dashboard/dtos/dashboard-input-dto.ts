import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const dashboardInputDtoSchema = z.object({ actor: authorizedActorSchema });

export const DashboardInputDto = dashboardInputDtoSchema.brand<"DashboardInputDto">().readonly();

export type DashboardInputDto = z.infer<typeof DashboardInputDto>;
