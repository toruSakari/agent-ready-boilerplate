import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { AccessQuery } from "#api/application/access/queries/access-query.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";

export async function assertServiceEntry(
  identity: Identity,
  access: Pick<AccessQuery, "isRegistered" | "qualified">,
) {
  const deny = () => {
    throw new ApplicationError({
      code: "FORBIDDEN",
      message: "このサービスの会員登録がないか、利用する権限がありません",
    });
  };
  if (!identity.channel) {
    return deny();
  }

  const kind = identity.channel === "admin" ? "operator" : identity.channel;
  if (!(await access.isRegistered(identity.userId, kind))) {
    return deny();
  }

  if (kind === "customer") {
    return;
  }

  if (kind === "operator") {
    if (!(await access.qualified(identity.userId, "platform", kind))) {
      deny();
    }

    return;
  }

  // 企業未選択でもサービス会員の確認は可能。企業を選んだ場合にだけその所属を要求する。
  if (identity.tenantId) {
    if (!(await access.qualified(identity.userId, identity.tenantId, kind))) {
      deny();
    }
  }
}
