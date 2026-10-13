import { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { toRpcError } from "#api/presentation/shared/errors.ts";
import { t } from "#api/presentation/shared/trpc-core.ts";

/** プラン未設定でも本人の変更を許可し、認可前の版を本人IDのスナップショットへ固定する。 */
export const requireCustomerAccessState = t.middleware(async (props) => {
  if (props.ctx.actor?.channel !== "customer") {
    throw toRpcError(
      new ApplicationError({ code: "FORBIDDEN", message: "一般ユーザー本人の操作が必要です" }),
    );
  }

  const identity = props.ctx.actor;
  try {
    const all = await props.ctx.container.accessRepository.load(PLATFORM_SCOPE);
    // 個人操作へ他人の会員や企業・所属情報を渡さない。版は共通revisionを維持する。
    const state = {
      version: all.version,
      customerAccounts: all.customerAccounts.filter((account) => account.id === identity.userId),
      organizations: [],
      businessAccounts: [],
      operatorAccounts: [],
      roles: [],
      memberships: [],
      invitations: [],
    };
    const actor = await prepareAuthorizedActor(
      props.ctx.container.identityProvider,
      props.ctx.actor,
      [],
      {
        scope: identity.userId,
        state,
      },
    );
    return props.next({ ctx: { actor } });
  } catch (error) {
    throw toRpcError(error);
  }
});
