import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";
import type { AuthorizationGrant } from "#api/application/auth/contracts/authorization-grant.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";

export interface ServiceIdentityProvider {
  /** リクエストの本人確認だけを行い、同じリクエスト内の会員解決で共有する。 */
  authenticate(request: Request): Promise<Identity>;
  /** 発行済みの本人情報から、選択したサービス会員と企業所属を独立して解決する。 */
  resolveActor(authenticated: Identity, actor: ServiceActor, tenantId: string): Promise<Identity>;
  /** 解決済みのサービス会員に対し、現在の登録・所属・実効権限を再確認する。 */
  authorize(identity: Identity, required: readonly PermissionCode[]): Promise<AuthorizationGrant>;
}
