import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { IdentityProvider } from "#api/application/auth/providers/identity-provider.ts";

// ローカルの本人確認用fixture。ヘッダーのroleはデモ本人の選択に使い、操作権限はDBで決める。
export class DemoIdentityProvider implements IdentityProvider {
  async authenticate(request: Request): Promise<Identity> {
    const role = request.headers.get("x-demo-role") === "member" ? "member" : "admin";

    const userId =
      request.headers.get("x-demo-user") ?? (role === "member" ? "demo-member" : "demo-user");
    return {
      userId,
      subjectId: userId,
      tenantId: request.headers.get("x-demo-tenant") ?? "demo-store",
      role,
      permissions: [],
      email:
        request.headers.get("x-demo-email") ??
        (userId === "demo-member" ? "member@example.com" : "demo@example.com"),
    };
  }
}
