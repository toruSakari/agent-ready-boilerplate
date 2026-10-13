import { z } from "zod";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { IdentityProvider } from "#api/application/auth/providers/identity-provider.ts";

const BEARER_TOKEN_PREFIX = "Bearer ";

/** 署名検証後も未完了セッションと本人識別子の欠落を拒否する。 */
function validateSessionClaims(payload: unknown) {
  const parsed = z
    .object({
      sub: z.string().min(1),
      sid: z.string().min(1),
      sts: z.literal("active").optional(),
    })
    .safeParse(payload);
  if (!parsed.success) {
    throw new ApplicationError({
      code: "UNAUTHORIZED",
      message: "認証が必要です。ログインし直してください",
    });
  }

  return parsed.data;
}

/** 本人の現在状態を照会し、削除・停止・ロック・取得失敗を拒否する。 */
async function activeClerkUser(client: ReturnType<typeof createClerkClient>, subjectId: string) {
  // 署名が有効でも本人が現在有効とは限らないため、Clerkの利用者状態も確認する。
  // 削除・停止・ロック・確認失敗では拒否し、サービス会員のデータは変更しない。
  const user = await client.users.getUser(subjectId).catch(() => {
    throw new ApplicationError({
      code: "UNAUTHORIZED",
      message: "認証情報を確認できません。ログインし直してください",
    });
  });
  if (user.banned || user.locked) {
    throw new ApplicationError({
      code: "UNAUTHORIZED",
      message: "認証情報を確認できません。ログインし直してください",
    });
  }

  return user;
}

// Clerkは本人確認のみを担当し、独立したサービス会員や企業権限はDB側で解決する。
export class ClerkIdentityProvider implements IdentityProvider {
  constructor(
    private readonly secretKey: string,
    private readonly authorizedParties: string[],
  ) {}

  async authenticate(request: Request): Promise<Identity> {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith(BEARER_TOKEN_PREFIX)
      ? authorization.slice(BEARER_TOKEN_PREFIX.length)
      : undefined;

    if (!token) {
      throw new ApplicationError({
        code: "UNAUTHORIZED",
        message: "認証が必要です。ログインし直してください",
      });
    }

    const payload = await verifyToken(token, {
      secretKey: this.secretKey,
      authorizedParties: this.authorizedParties,
    }).catch(() => {
      throw new ApplicationError({
        code: "UNAUTHORIZED",
        message: "認証が必要です。ログインし直してください",
      });
    });
    const claims = validateSessionClaims(payload);
    const client = createClerkClient({ secretKey: this.secretKey });
    const session = await client.sessions.getSession(claims.sid).catch(() => {
      throw new ApplicationError({
        code: "UNAUTHORIZED",
        message: "認証情報を確認できません。ログインし直してください",
      });
    });
    if (session.status !== "active" || session.userId !== claims.sub) {
      throw new ApplicationError({
        code: "UNAUTHORIZED",
        message: "認証が必要です。ログインし直してください",
      });
    }

    const user = await activeClerkUser(client, claims.sub);
    // 招待承諾の本人照合へ渡すメールは、確認済みの主メールだけに限定する。
    const email = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId && e.verification?.status === "verified",
    )?.emailAddress;
    return {
      permissions: [],
      email,
      userId: claims.sub,
      subjectId: claims.sub,
      tenantId: "",
      role: "member",
    };
  }
}
