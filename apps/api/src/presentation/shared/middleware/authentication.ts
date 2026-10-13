import { createMiddleware } from "hono/factory";
import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { ApplicationContainer } from "#api/application/container.ts";
import { createContainer } from "#api/composition-root.ts";

export type RequestActorContext = {
  container: ApplicationContainer | undefined;
  actor: Identity | undefined;
  authenticationError: unknown;
};

export type RequestActorEnv = { Variables: RequestActorContext };

/**
 * Honoの一要求で本人確認を一度だけ行う。複数サービスを含むバッチでも、このactorは本人情報のまま保つ。
 * 失敗は後段へ渡し、tRPCのエラー形式で認証エラーを返す。
 */
export const authenticateRequest = createMiddleware<RequestActorEnv>(async (context, next) => {
  context.set("container", undefined);
  context.set("actor", undefined);
  context.set("authenticationError", undefined);
  try {
    const container = createContainer();
    context.set("container", container);
    context.set("actor", await container.identityProvider.authenticate(context.req.raw));
  } catch (error) {
    context.set("authenticationError", error);
  }

  await next();
});
