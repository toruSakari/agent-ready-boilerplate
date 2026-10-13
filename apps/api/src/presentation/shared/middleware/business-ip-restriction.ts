import { parseInputDto } from "#api/application/shared/parse-input-dto.ts";
import { AccessOrganizationAssertBusinessIpInputDto } from "#api/application/access/dtos/access-organization-assert-business-ip-input-dto.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { t } from "#api/presentation/shared/trpc-core.ts";
import { toRpcError } from "#api/presentation/shared/errors.ts";

/** 会員解決後・操作権限の確認前に接続し、企業の現在の許可IPを検査する。 */
export const requireBusinessIp = t.middleware(async (props) => {
  const actor = props.ctx.actor;
  if (!actor) {
    throw toRpcError(
      new ApplicationError({ code: "FORBIDDEN", message: "認証済みの会員が必要です" }),
    );
  }

  // 企業未選択の入口や本人のライフサイクル操作は企業スコープを持たない。
  // 混在バッチでも、この手続きで解決した会員だけを使って対象を決める。
  if (actor.channel === "business" && actor.tenantId) {
    try {
      // Cloudflare付与の接続元だけを使い、任意のX-Forwarded-Forは信用しない。
      await props.ctx.container.access.assertBusinessIp(
        parseInputDto(AccessOrganizationAssertBusinessIpInputDto, {
          scope: actor.tenantId,
          clientIp: props.ctx.request.headers.get("cf-connecting-ip"),
        }),
      );
    } catch (error) {
      throw toRpcError(error);
    }
  }

  return props.next();
});
