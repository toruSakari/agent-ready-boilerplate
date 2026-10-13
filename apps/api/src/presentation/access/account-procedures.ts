import { parseInputDto } from "#api/application/shared/parse-input-dto.ts";
import { AccessDirectorySessionInputDto } from "#api/application/access/dtos/access-directory-session-input-dto.ts";
import { AccessDirectoryListUsersInputDto } from "#api/application/access/dtos/access-directory-list-users-input-dto.ts";
import { AccessRegistrationInputDto } from "#api/application/access/dtos/access-registration-input-dto.ts";
import { AccessRegisterCustomerInputDto } from "#api/application/access/dtos/access-register-customer-input-dto.ts";
import { AccessWithdrawInputDto } from "#api/application/access/dtos/access-withdraw-input-dto.ts";
import { AccessDeleteUserInputDto } from "#api/application/access/dtos/access-delete-user-input-dto.ts";
import { AccessAcceptInvitationInputDto } from "#api/application/access/dtos/access-accept-invitation-input-dto.ts";
import { CustomerPlanPlansInputDto } from "#api/application/access/dtos/customer-plan-plans-input-dto.ts";
import { CustomerPlanChangeInputDto } from "#api/application/access/dtos/customer-plan-change-input-dto.ts";
import { requireCustomerAccessState } from "#api/presentation/access/middleware/require-customer-access-state.ts";
import { requireBusinessIp } from "#api/presentation/shared/middleware/business-ip-restriction.ts";
import {
  requireAccessPermissions,
  scopeSchema,
} from "#api/presentation/access/middleware/trpc-authorization.ts";
import { z } from "zod";
import { t, procedure } from "#api/presentation/shared/trpc-core.ts";
import {
  requireActor,
  serviceSchema,
  requirePermissions,
} from "#api/presentation/shared/middleware/trpc-authorization.ts";
import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { ACCOUNT_CATEGORIES } from "#api/domain/access/policies/account-categories.ts";

export const accountProcedures = t.router({
  customerPlans: procedure
    .use(requireActor("customer"))
    .use(requirePermissions([]))
    .query((props) =>
      props.ctx.container.access.customerPlans(
        parseInputDto(CustomerPlanPlansInputDto, { identity: props.ctx.actor }),
      ),
    ),
  changeCustomerPlan: procedure
    .use(requireActor("customer"))
    .use(requireCustomerAccessState)
    .input(z.object({ planCode: scopeSchema.nullable() }).strict())
    .mutation((props) =>
      props.ctx.container.access
        .changeCustomerPlan(
          parseInputDto(CustomerPlanChangeInputDto, {
            identity: props.ctx.actor,
            input: props.input,
          }),
        )
        .then(() => undefined),
    ),
  registration: procedure
    .use(requireActor(ACCOUNT_CATEGORIES, { purpose: "registration" }))
    .use(requirePermissions([]))
    .meta({ standalone: true })
    .input(serviceSchema)
    .query((props) =>
      props.ctx.container.access.registration(
        parseInputDto(AccessRegistrationInputDto, { identity: props.ctx.actor }),
      ),
    ),
  registerCustomer: procedure
    .use(requireActor("customer", { purpose: "registration" }))
    .use(requirePermissions([]))
    .meta({ standalone: true })
    .input(z.object({ name: z.string().trim().min(1).max(ACCESS_LIMITS.nameMaxLength) }))
    .mutation((props) =>
      props.ctx.container.access.registerCustomer(
        parseInputDto(AccessRegisterCustomerInputDto, {
          identity: props.ctx.actor,
          input: props.input,
        }),
      ),
    ),
  withdraw: procedure
    .use(requireActor(ACCOUNT_CATEGORIES, { purpose: "withdrawal" }))
    .use(requirePermissions([]))
    .meta({ standalone: true })
    .input(serviceSchema)
    .mutation((props) =>
      props.ctx.container.access.withdraw(
        parseInputDto(AccessWithdrawInputDto, { identity: props.ctx.actor }),
      ),
    ),
  session: procedure
    .use(requireActor(ACCOUNT_CATEGORIES))
    .use(requireBusinessIp)
    .use(requirePermissions([]))
    .input(serviceSchema)
    .query((props) =>
      props.ctx.container.access.session(
        parseInputDto(AccessDirectorySessionInputDto, { identity: props.ctx.actor }),
      ),
    ),
  users: procedure
    .use(requireActor("operator"))
    .use(requireAccessPermissions(["user.read"], PLATFORM_SCOPE))
    .query((props) =>
      props.ctx.container.access
        .listUsers(parseInputDto(AccessDirectoryListUsersInputDto, { identity: props.ctx.actor }))
        .then((result) => result.items),
    ),
  deleteUser: procedure
    .use(requireActor("operator"))
    .use(requireAccessPermissions(["user.delete"], PLATFORM_SCOPE))
    .input(z.object({ userId: scopeSchema }))
    .mutation((props) =>
      props.ctx.container.access
        .deleteUser(
          parseInputDto(AccessDeleteUserInputDto, {
            identity: props.ctx.actor,
            userId: props.input.userId,
          }),
        )
        .then(() => undefined),
    ),
  acceptInvitation: procedure
    .use(requireActor(ACCOUNT_CATEGORIES, { purpose: "invitation" }))
    .use(requirePermissions([]))
    .meta({ standalone: true })
    .input(serviceSchema)
    .input(
      z.object({
        token: z.string().regex(/^[a-f0-9]{64}$/),
        name: z.string().trim().min(1).max(ACCESS_LIMITS.nameMaxLength),
      }),
    )
    .mutation((props) =>
      props.ctx.container.access.acceptInvitation(
        parseInputDto(AccessAcceptInvitationInputDto, {
          identity: props.ctx.actor,
          input: { token: props.input.token, name: props.input.name },
        }),
      ),
    ),
});
