import {
  customerAccountTestCalls,
  businessAccountTestCalls,
  operatorAccountTestCalls,
} from "#api/test/use-case-test-clients.ts";
import { accessReaderFixture } from "#api/test/access-reader-fixture.ts";
import type { AccessQuery } from "#api/application/access/queries/access-query.ts";
import { BusinessAccountUseCases } from "#api/application/access/use-cases/business-account-use-cases.ts";
import { CustomerAccountUseCases } from "#api/application/access/use-cases/customer-account-use-cases.ts";
import { OperatorAccountUseCases } from "#api/application/access/use-cases/operator-account-use-cases.ts";
import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { AccessRepository } from "#api/domain/access/repositories/access-repository.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { AccountIdentityProvider } from "#api/application/auth/providers/account-identity-provider.ts";
import { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";
import type { AuthorizedActor } from "#api/application/auth/contracts/authorized-actor.ts";
import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";
import { authenticateActor } from "#api/test/authorized-actor.ts";

// 管理削除の入口で現在権限を検査し、同じスナップショットを業務操作へ渡す。
export function authorizedRemoval<Id>(
  repository: AccessRepository,
  query: AccessQuery,
  invoke: (actor: AuthorizedActor, accountId: Id) => Promise<void>,
) {
  return async (fixture: Identity, accountId: Id) => {
    const provider = new AccountIdentityProvider({ authenticate: async () => fixture }, query);
    const identity = await authenticateActor(provider, new Request("http://localhost/api/trpc"), {
      service: fixture.channel === "admin" ? "operator" : (fixture.channel ?? "business"),
    });
    const state = await repository.load(PLATFORM_SCOPE);
    const actor = await prepareAuthorizedActor(provider, identity, ["user.delete"], {
      scope: PLATFORM_SCOPE,
      state,
    });
    return invoke(actor, accountId);
  };
}

// 本人確認と用途付きのサービス会員解決は、業務操作の前に通信境界と同じ手順で行う。
export function lifecycle<Args extends unknown[], Result>(
  query: AccessQuery,
  purpose: NonNullable<ServiceActor["purpose"]>,
  invoke: (actor: AuthorizedActor, ...args: Args) => Promise<Result>,
) {
  return async (fixture: Identity, ...args: Args): Promise<Result> => {
    const provider = new AccountIdentityProvider({ authenticate: async () => fixture }, query);
    const identity = await authenticateActor(provider, new Request("http://localhost/api/trpc"), {
      service: fixture.channel === "admin" ? "operator" : (fixture.channel ?? "business"),
      purpose,
    });
    return invoke(await prepareAuthorizedActor(provider, identity, []), ...args);
  };
}

export function lifecycleClients(
  repository: AccessRepository,
  query: AccessQuery,
  state: import("#api/domain/access/repositories/access-repository.ts").AccessRecords,
) {
  const { customers, businesses, operators } = lifecycleProviders(repository, query, state);
  const customerCalls = customerAccountTestCalls(customers);
  const businessCalls = businessAccountTestCalls(businesses);
  const operatorCalls = operatorAccountTestCalls(operators);
  return {
    raw: { customers, businesses, operators },
    customers: {
      registration: lifecycle(query, "registration", customerCalls.registration),
      register: lifecycle(query, "registration", customerCalls.register),
      acceptInvitation: lifecycle(query, "invitation", customerCalls.acceptInvitation),
      withdraw: lifecycle(query, "withdrawal", customerCalls.withdraw),
      removeByOperator: authorizedRemoval(repository, query, customerCalls.removeByOperator),
    },
    businesses: {
      registration: lifecycle(query, "registration", businessCalls.registration),
      registerFromInvitation: lifecycle(query, "invitation", businessCalls.registerFromInvitation),
      withdraw: lifecycle(query, "withdrawal", businessCalls.withdraw),
      removeByOperator: authorizedRemoval(repository, query, businessCalls.removeByOperator),
    },
    operators: {
      registration: lifecycle(query, "registration", operatorCalls.registration),
      registerFromInvitation: lifecycle(query, "invitation", operatorCalls.registerFromInvitation),
      stop: lifecycle(query, "withdrawal", operatorCalls.stop),
      removeByOperator: authorizedRemoval(repository, query, operatorCalls.removeByOperator),
    },
  };
}

function lifecycleProviders(
  repository: AccessRepository,
  query: AccessQuery,
  state: import("#api/domain/access/repositories/access-repository.ts").AccessRecords,
) {
  const reader = accessReaderFixture(query, state);
  const customers = new CustomerAccountUseCases(repository, reader);
  const businesses = new BusinessAccountUseCases(repository, reader);
  const operators = new OperatorAccountUseCases(repository, reader);
  return { customers, businesses, operators };
}
