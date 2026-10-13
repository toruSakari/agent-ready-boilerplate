import { z } from "zod";
import { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";
import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import { ACCOUNT_CATEGORIES } from "#api/domain/access/policies/account-categories.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";
import { t } from "#api/presentation/shared/trpc-core.ts";

import { toRpcError } from "#api/presentation/shared/errors.ts";

/** requireActorの後に接続し、現在のDB権限を満たすActorをこの操作だけに渡す。 */
export const requirePermissions = (required: readonly PermissionCode[]) =>
  t.middleware(async (props) => {
    if (!props.ctx.actor) {
      throw toRpcError(
        new ApplicationError({ code: "FORBIDDEN", message: "認証済みの会員が必要です" }),
      );
    }

    const actor = await prepareAuthorizedActor(
      props.ctx.container.identityProvider,
      props.ctx.actor,
      required,
    ).catch((error: unknown) => {
      throw toRpcError(error);
    });
    return props.next({ ctx: { actor } });
  });

export const serviceSchema = z.object({ service: z.enum(ACCOUNT_CATEGORIES) });

/** 操作するサービス会員を検証する。権限ガードより先に.useで接続する。 */
export const requireActor = (
  required: AccountCategoryCode | readonly AccountCategoryCode[],
  options: Pick<ServiceActor, "purpose"> = {},
) => {
  const allowed = typeof required === "string" ? required : [...required];
  const purpose = options.purpose;
  return t.middleware(async (props) => {
    let service: AccountCategoryCode;
    if (typeof allowed === "string") {
      // 手続きに固定したサービスを、呼び出し側の入力で切り替えさせない。
      service = allowed;
    } else {
      const selected = serviceSchema.safeParse(props.input ?? (await props.getRawInput()));
      if (!selected.success) {
        throw toRpcError(
          new ApplicationError({
            code: "BAD_REQUEST",
            message: "操作するサービスを指定してください",
          }),
        );
      }

      service = selected.data.service;
      if (!allowed.includes(service)) {
        throw toRpcError(
          new ApplicationError({
            code: "FORBIDDEN",
            message: "この種類の会員は操作できません",
          }),
        );
      }
    }

    const actor = await props.ctx.resolveActor({ service, ...(purpose ? { purpose } : {}) });
    const actualService = actor.channel === "admin" ? "operator" : actor.channel;
    // 入力のserviceではなく、プロバイダーが本人から解決した会員種別で後段への通過を決める。
    if (actualService !== service) {
      throw toRpcError(
        new ApplicationError({
          code: "FORBIDDEN",
          message: "この種類の会員は操作できません",
        }),
      );
    }

    return props.next({ ctx: { actor } });
  });
};
