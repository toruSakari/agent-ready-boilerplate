import { parseInputDto } from "#api/application/shared/parse-input-dto.ts";
import { ListOrganizationDirectoryInputDto } from "#api/application/access/dtos/list-organization-directory-input-dto.ts";
import { AccessOrganizationBusinessIpPolicyInputDto } from "#api/application/access/dtos/access-organization-business-ip-policy-input-dto.ts";
import { AccessOrganizationUpdateBusinessIpPolicyInputDto } from "#api/application/access/dtos/access-organization-update-business-ip-policy-input-dto.ts";
import { AccessOrganizationListPlansInputDto } from "#api/application/access/dtos/access-organization-list-plans-input-dto.ts";
import { AccessOrganizationOrganizationPlanInputDto } from "#api/application/access/dtos/access-organization-organization-plan-input-dto.ts";
import { AccessOrganizationAssignPlanInputDto } from "#api/application/access/dtos/access-organization-assign-plan-input-dto.ts";
import { AccessOrganizationListOrganizationsInputDto } from "#api/application/access/dtos/access-organization-list-organizations-input-dto.ts";
import { AccessOrganizationCreateOrganizationInputDto } from "#api/application/access/dtos/access-organization-create-organization-input-dto.ts";
import { AccessOrganizationUpdateOrganizationInputDto } from "#api/application/access/dtos/access-organization-update-organization-input-dto.ts";
import { organizationFiltersSchema } from "#api/domain/shared/list-filters.ts";
import { PAGE_LIMITS } from "#api/application/shared/pagination.ts";
import {
  requireAccessPermissions,
  scopeSchema,
} from "#api/presentation/access/middleware/trpc-authorization.ts";
import { z } from "zod";
import { t, procedure } from "#api/presentation/shared/trpc-core.ts";
import {
  requireActor,
  requirePermissions,
} from "#api/presentation/shared/middleware/trpc-authorization.ts";
import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { BUSINESS_IP_MAX_ENTRIES } from "#api/domain/access/entities/organization.ts";

export const organizationProcedures = t.router({
  businessIpPolicy: procedure
    .use(requireActor("operator"))
    .use(requireAccessPermissions(["organization.manage"], PLATFORM_SCOPE))
    .input(z.object({ id: scopeSchema }))
    .query((props) =>
      props.ctx.container.access.businessIpPolicy(
        parseInputDto(AccessOrganizationBusinessIpPolicyInputDto, {
          identity: props.ctx.actor,
          id: props.input.id,
        }),
      ),
    ),
  updateBusinessIpPolicy: procedure
    .use(requireActor("operator"))
    .use(requireAccessPermissions(["organization.manage"], PLATFORM_SCOPE))
    .input(
      z.object({
        id: scopeSchema,
        enabled: z.boolean(),
        allowedIps: z.array(z.string().trim().min(1).max(64)).max(BUSINESS_IP_MAX_ENTRIES),
      }),
    )
    .mutation(async (props) => {
      await props.ctx.container.access.updateBusinessIpPolicy(
        parseInputDto(AccessOrganizationUpdateBusinessIpPolicyInputDto, {
          identity: props.ctx.actor,
          input: props.input,
        }),
      );
    }),
  plans: procedure
    .use(requireActor("operator"))
    .use(requirePermissions(["plan.manage"]))
    .input(z.object({ category: z.literal("business") }))
    .query((props) =>
      props.ctx.container.access
        .listPlans(
          parseInputDto(AccessOrganizationListPlansInputDto, {
            _identity: props.ctx.actor,
            category: props.input.category,
          }),
        )
        .then((result) => result.items),
    ),
  organizationPlan: procedure
    .use(requireActor("operator"))
    .use(requireAccessPermissions(["organization.read", "plan.manage"], PLATFORM_SCOPE))
    .input(z.object({ id: scopeSchema }))
    .query((props) =>
      props.ctx.container.access.organizationPlan(
        parseInputDto(AccessOrganizationOrganizationPlanInputDto, {
          identity: props.ctx.actor,
          id: props.input.id,
        }),
      ),
    ),
  assignPlan: procedure
    .use(requireActor("operator"))
    .use(requireAccessPermissions(["plan.manage"], PLATFORM_SCOPE))
    .input(
      z.object({
        category: z.literal("business"),
        id: scopeSchema,
        planCode: scopeSchema.nullable(),
      }),
    )
    .mutation((props) =>
      props.ctx.container.access
        .assignPlan(
          parseInputDto(AccessOrganizationAssignPlanInputDto, {
            identity: props.ctx.actor,
            input: props.input,
          }),
        )
        .then(() => undefined),
    ),
  organizationPlanOptions: procedure
    .use(requireActor("operator"))
    .use(requireAccessPermissions(["organization.read"], PLATFORM_SCOPE))
    .query(async (props) =>
      (
        await props.ctx.container.access
          .listPlans(
            parseInputDto(AccessOrganizationListPlansInputDto, {
              _identity: props.ctx.actor,
              category: "business",
            }),
          )
          .then((result) => result.items)
      ).map((inputProps) => ({
        code: inputProps.code,
        name: inputProps.name,
      })),
    ),
  organizationDirectory: procedure
    .use(requireActor("operator"))
    .use(requireAccessPermissions(["organization.read"], PLATFORM_SCOPE))
    .input(
      organizationFiltersSchema
        .extend({
          limit: z.number().int().min(1).max(PAGE_LIMITS.maxSize).default(PAGE_LIMITS.defaultSize),
          afterId: z.string().min(1).max(ACCESS_LIMITS.idMaxLength).optional(),
        })
        .strict(),
    )
    .query((props) =>
      props.ctx.container.organizationDirectory.execute(
        parseInputDto(ListOrganizationDirectoryInputDto, {
          actor: props.ctx.actor,
          filters: props.input,
          page: props.input,
        }),
      ),
    ),
  organizations: procedure
    .use(requireActor("operator"))
    .use(requireAccessPermissions(["organization.read"], PLATFORM_SCOPE))
    .query((props) =>
      props.ctx.container.access
        .listOrganizations(
          parseInputDto(AccessOrganizationListOrganizationsInputDto, { identity: props.ctx.actor }),
        )
        .then((result) => result.items),
    ),
  createOrganization: procedure
    .use(requireActor("operator"))
    .use(requireAccessPermissions(["organization.manage"], PLATFORM_SCOPE))
    .input(z.object({ name: z.string().trim().min(1).max(ACCESS_LIMITS.nameMaxLength) }))
    .mutation((props) =>
      props.ctx.container.access.createOrganization(
        parseInputDto(AccessOrganizationCreateOrganizationInputDto, {
          identity: props.ctx.actor,
          input: props.input,
        }),
      ),
    ),
  updateOrganization: procedure
    .use(requireActor("operator"))
    .use(requireAccessPermissions(["organization.manage"], PLATFORM_SCOPE))
    .input(
      z.object({
        id: scopeSchema,
        name: z.string().trim().min(1).max(ACCESS_LIMITS.nameMaxLength),
        active: z.boolean(),
        invitationsEnabled: z.boolean(),
      }),
    )
    .mutation((props) =>
      props.ctx.container.access
        .updateOrganization(
          parseInputDto(AccessOrganizationUpdateOrganizationInputDto, {
            identity: props.ctx.actor,
            input: props.input,
          }),
        )
        .then(() => undefined),
    ),
});
