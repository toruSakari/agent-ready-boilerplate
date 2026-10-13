import { env } from "cloudflare:workers";
import { initTRPC } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { z } from "zod";
import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";
import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { ApplicationContainer } from "#api/application/container.ts";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import type { RequestActorContext } from "#api/presentation/shared/middleware/authentication.ts";
import {
  publicErrorCode,
  publicErrorMessage,
  toRpcError,
} from "#api/presentation/shared/errors.ts";
import { verifyAdminAccess } from "#api/infrastructure/auth/providers/cloudflare-access-verifier.ts";

const SINGLE_RPC_CALL = 1;
const procedureMetadata = z.object({
  standalone: z.boolean().optional(),
  public: z.boolean().optional(),
});

type TrpcContext = {
  container: ApplicationContainer;
  resolveActor: (selection: ServiceActor) => Promise<Identity>;
  request: Request;
  resolveCustomer: () => Promise<Identity>;
  actor?: Identity;
};

/** バッチ全体の操作契約を、会員解決より先に検査する。 */
function assertBatchProcedures(info: FetchCreateContextFnOptions["info"]) {
  // URL文字列ではなく解決済み手続きのメタデータで判定し、実行前に混在バッチ全体を拒否する。
  if (
    info.calls.length > SINGLE_RPC_CALL &&
    info.calls.some((call) => {
      const meta = procedureMetadata.safeParse(call.procedure?._def.meta);
      return meta.success && meta.data.standalone;
    })
  ) {
    throw toRpcError(
      new ApplicationError({
        code: "BAD_REQUEST",
        message: "この操作は単独で実行してください",
      }),
    );
  }
}

/** 一般購入者の解決には、要求ヘッダーの企業指定を使わない。 */
function customerResolver(
  container: ApplicationContainer,
  requestActor: Identity | undefined,
  authenticationError: unknown,
) {
  const resolveCustomer = async () => {
    if (!requestActor) {
      throw toRpcError(
        authenticationError ??
          new ApplicationError({ code: "UNAUTHORIZED", message: "認証が必要です" }),
      );
    }

    // 一般購入者の会員確認は企業所属と独立。企業ヘッダーで本人注文の範囲を変更しない。
    return container.identityProvider
      .resolveActor(requestActor, { service: "customer" }, "")
      .catch((error: unknown) => {
        throw toRpcError(error);
      });
  };
  return resolveCustomer;
}

export function createTrpcContext(
  request: Request,
  info: FetchCreateContextFnOptions["info"],
  requestContext: RequestActorContext,
): TrpcContext {
  assertBatchProcedures(info);
  const { container, actor: requestActor, authenticationError } = requestContext;
  if (
    !container ||
    (!requestActor &&
      info.calls.some(
        (call) => !procedureMetadata.safeParse(call.procedure?._def.meta).data?.public,
      ))
  ) {
    throw toRpcError(
      authenticationError ??
        new ApplicationError({
          code: "UNAUTHORIZED",
          message: "認証が必要です。ログインし直してください",
        }),
    );
  }

  let operatorAccess: Promise<void> | undefined;
  const resolveActor = async (selection: ServiceActor) => {
    try {
      if (!requestActor) {
        throw (
          authenticationError ??
          new ApplicationError({ code: "UNAUTHORIZED", message: "認証が必要です" })
        );
      }

      if (selection.service === "operator") {
        operatorAccess ??= verifyAdminAccess(request, env);
        await operatorAccess;
      }

      // 手続きごとに会員を解決し、同じバッチ内の別サービスの権限を使い回さない。
      return await container.identityProvider.resolveActor(
        requestActor,
        selection,
        request.headers.get("x-organization-id") ?? "",
      );
    } catch (error) {
      throw toRpcError(error);
    }
  };
  const resolveCustomer = customerResolver(container, requestActor, authenticationError);
  return { container, resolveActor, resolveCustomer, request };
}

export const t = initTRPC
  .context<TrpcContext>()
  .meta<{ standalone?: boolean; public?: boolean }>()
  .create({
    errorFormatter(props) {
      // 文言の変換だけでなく、tRPCが持つ内部スタックも公開応答から除く。
      const { stack: _stack, ...data } = props.shape.data;
      return {
        ...props.shape,
        message: publicErrorMessage(props.error),
        data: { ...data, errorCode: publicErrorCode(props.error) },
      };
    },
  });
export const procedure = t.procedure.use(async (props) => {
  const result = await props.next();
  if (!result.ok && result.error.cause instanceof ApplicationError) {
    throw toRpcError(result.error.cause);
  }

  return result;
});
