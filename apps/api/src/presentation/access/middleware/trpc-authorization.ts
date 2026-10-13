import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { PLATFORM_SCOPE } from "#api/domain/access/policies/platform-scope.ts";
import { z } from "zod";
import { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import { t } from "#api/presentation/shared/trpc-core.ts";

import { toRpcError } from "#api/presentation/shared/errors.ts";

/**
 * 権限の再検査より先に読んだ状態を、この操作のActorへ結び付ける。
 * 保存時もこの版を比較し、認可後の競合を新しい版で上書きしない。
 */
export const requireAccessPermissions = (
  required: readonly PermissionCode[],
  fixedScope?: string,
) =>
  t.middleware(async (props) => {
    if (!props.ctx.actor) {
      throw toRpcError(
        new ApplicationError({ code: "FORBIDDEN", message: "認証済みの会員が必要です" }),
      );
    }

    try {
      const scope = fixedScope ?? z.object({ scope: z.string().min(1) }).parse(props.input).scope;
      const state = await props.ctx.container.accessRepository.load(scope);
      const actor = await prepareAuthorizedActor(
        props.ctx.container.identityProvider,
        props.ctx.actor,
        required,
        { scope, state },
      );
      return props.next({ ctx: { actor } });
    } catch (error) {
      throw toRpcError(error);
    }
  });

export const scopeSchema = z.string().min(1).max(ACCESS_LIMITS.idMaxLength);
export const scopedInput = z.object({
  service: z.enum(["business", "operator"]),
  scope: scopeSchema,
});
// 状態の読込・権限検査より先に対象企業を限定するため、scopeの入力検証後に接続する。
export const requireAccessScope = t.middleware((props) => {
  const actor = props.ctx.actor;
  if (!actor || actor.channel === "customer") {
    throw toRpcError(
      new ApplicationError({ code: "FORBIDDEN", message: "この操作を行う権限がありません" }),
    );
  }

  const { scope } = scopedInput.parse(props.input);
  // scopeは操作対象の指定にすぎないため、企業会員には認証済み企業との一致を要求する。
  if (actor.channel !== "admin" && (scope === PLATFORM_SCOPE || scope !== actor.tenantId)) {
    throw toRpcError(
      new ApplicationError({ code: "FORBIDDEN", message: "この企業を利用する権限がありません" }),
    );
  }

  return props.next();
});
