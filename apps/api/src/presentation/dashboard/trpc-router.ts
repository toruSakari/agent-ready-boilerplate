import { parseInputDto } from "#api/application/shared/parse-input-dto.ts";
import { DashboardInputDto } from "#api/application/dashboard/dtos/dashboard-input-dto.ts";
import { t, procedure } from "#api/presentation/shared/trpc-core.ts";
import {
  requireActor,
  requirePermissions,
} from "#api/presentation/shared/middleware/trpc-authorization.ts";
import { requireBusinessIp } from "#api/presentation/shared/middleware/business-ip-restriction.ts";

export const dashboardRouter = t.router({
  summary: procedure
    .use(requireActor("business"))
    .use(requireBusinessIp)
    .use(requirePermissions([]))
    .query((props) =>
      props.ctx.container.dashboard.execute(
        parseInputDto(DashboardInputDto, { actor: props.ctx.actor }),
      ),
    ),
});
