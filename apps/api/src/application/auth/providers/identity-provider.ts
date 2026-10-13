import type { Identity } from "#api/application/auth/contracts/identity.ts";

/** 外部認証で本人を確認する契約。サービス会員の解決と現在権限の認可は別に行う。 */
export interface IdentityProvider {
  authenticate(request: Request): Promise<Identity>;
}
