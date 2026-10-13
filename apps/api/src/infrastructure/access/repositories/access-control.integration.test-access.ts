import { accessUseCaseTestCalls } from "#api/test/use-case-test-clients.ts";
import { AccountIdentityProvider } from "#api/application/auth/providers/account-identity-provider.ts";
import { authenticateActor } from "#api/test/authorized-actor.ts";
import { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";
import type { AuthorizedActor } from "#api/application/auth/contracts/authorized-actor.ts";
import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { AccessUseCases } from "#api/application/access/use-cases/access-use-cases.ts";
import type { AccessQuery } from "#api/application/access/queries/access-query.ts";
import type { AccessRepository } from "#api/domain/access/repositories/access-repository.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";

function createOperation(query: AccessQuery, repository: AccessRepository) {
  return function operation<Args extends unknown[], Result>(
    invoke: (actor: AuthorizedActor, ...args: Args) => Promise<Result>,
    required: readonly PermissionCode[],
    scopeFor?: (...args: NoInfer<Args>) => string,
    purpose?: ServiceActor["purpose"],
  ) {
    return async (fixture: Identity, ...args: Args): Promise<Result> => {
      const identityProvider = new AccountIdentityProvider(
        { authenticate: async () => fixture },
        query,
      );
      const identity = await authenticateActor(
        identityProvider,
        new Request("http://localhost/api/trpc", {
          headers: { "x-organization-id": fixture.tenantId },
        }),
        {
          service: fixture.channel === "admin" ? "operator" : (fixture.channel ?? "business"),
          purpose,
        },
      );
      const scope = scopeFor?.(...args);
      const snapshot =
        scope === undefined ? undefined : { scope, state: await repository.load(scope) };
      const actor = await prepareAuthorizedActor(identityProvider, identity, required, snapshot);
      return invoke(actor, ...args);
    };
  };
}

function accessOperations1(
  useCases: ReturnType<typeof accessUseCaseTestCalls>,
  operation: ReturnType<typeof createOperation>,
) {
  return {
    session: operation(useCases.session.bind(useCases), []),
    listOrganizations: operation(
      useCases.listOrganizations.bind(useCases),
      ["organization.read"],
      () => "platform",
    ),
    createOrganization: operation(
      useCases.createOrganization.bind(useCases),
      ["organization.manage"],
      () => "platform",
    ),
    businessIpPolicy: operation(
      useCases.businessIpPolicy.bind(useCases),
      ["organization.manage"],
      () => "platform",
    ),
    updateBusinessIpPolicy: operation(
      useCases.updateBusinessIpPolicy.bind(useCases),
      ["organization.manage"],
      () => "platform",
    ),
    updateOrganization: operation(
      useCases.updateOrganization.bind(useCases),
      ["organization.manage"],
      () => "platform",
    ),
    listMembers: operation(useCases.listMembers.bind(useCases), ["member.read"], (scope) => scope),
  };
}

function accessOperations2(
  useCases: ReturnType<typeof accessUseCaseTestCalls>,
  operation: ReturnType<typeof createOperation>,
) {
  return {
    listUsers: operation(useCases.listUsers.bind(useCases), ["user.read"], () => "platform"),
    roles: operation(useCases.roles.bind(useCases), ["member.read"], (scope) => scope),
    saveRole: operation(useCases.saveRole.bind(useCases), ["role.manage"], (input) => input.scope),
    assignRole: operation(
      useCases.assignRole.bind(useCases),
      ["member.assign_role"],
      (input) => input.scope,
    ),
    removeMember: operation(
      useCases.removeMember.bind(useCases),
      ["member.remove"],
      (input) => input.scope,
    ),
    deleteUser: operation(useCases.deleteUser.bind(useCases), ["user.delete"], () => "platform"),
    registration: operation(useCases.registration.bind(useCases), [], undefined, "registration"),
  };
}

function accessOperations3(
  useCases: ReturnType<typeof accessUseCaseTestCalls>,
  operation: ReturnType<typeof createOperation>,
) {
  return {
    registerCustomer: operation(
      useCases.registerCustomer.bind(useCases),
      [],
      undefined,
      "registration",
    ),
    withdraw: operation(useCases.withdraw.bind(useCases), [], undefined, "withdrawal"),
    invite: operation(useCases.invite.bind(useCases), ["member.invite"], (input) => input.scope),
    acceptInvitation: operation(
      useCases.acceptInvitation.bind(useCases),
      [],
      undefined,
      "invitation",
    ),
    audit: operation(useCases.audit.bind(useCases), ["audit.read"], (scope) => scope),
  };
}

export function authenticatedAccess(
  useCases: AccessUseCases,
  query: AccessQuery,
  repository: AccessRepository,
) {
  const operation = createOperation(query, repository);
  return {
    ...accessOperations1(accessUseCaseTestCalls(useCases), operation),
    ...accessOperations2(accessUseCaseTestCalls(useCases), operation),
    ...accessOperations3(accessUseCaseTestCalls(useCases), operation),
  };
}
