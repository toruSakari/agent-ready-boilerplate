import { createTRPCClient, TRPCClientError } from "@trpc/client";
import type { TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter, RouterOutputs } from "@dev-template/api-types";
import type { Service } from "@dev-template/client/api";
import { STORY_SERVICES } from "@/.storybook/story-fixtures.ts";
import type { StoryFixtures, StoryResult } from "@/.storybook/story-fixtures.ts";

// 本番と同じ画像DTOを使い、SVGやHTTP専用のfixtureで契約違反を隠さない。
const STORY_IMAGE = {
  base64:
    "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",
  contentType: "image/png",
  etag: "storybook-product-image",
} satisfies RouterOutputs["product"]["getImage"];

const serviceProcedures = new Set([
  "health",
  "access.registration",
  "access.session",
  "access.withdraw",
  "access.acceptInvitation",
  "access.members",
  "access.roles",
  "access.rolePermissionCatalog",
  "access.audit",
  "access.invite",
  "access.assignRole",
  "access.removeMember",
  "access.saveRole",
  "order.list",
  "order.create",
  "order.update",
  "order.transition",
  "product.list",
  "product.getImage",
]);

// fixture未定義の通信は失敗にし、本番APIへ流すHTTP linkを持たせない。
export function createStoryClient(fixtures: StoryFixtures) {
  const service = STORY_SERVICES[fixtures.mode ?? "web"];
  return createTRPCClient<AppRouter>({ links: [storyLink(fixtures, service)] });
}

function storyResult(fixtures: StoryFixtures, path: string, type: string): StoryResult | undefined {
  const result = (type === "mutation" ? fixtures.mutations : fixtures.queries)?.[path];
  if (result) {
    return result;
  }

  if (path === "access.businessIpPolicy") {
    return { data: { enabled: false, allowedIps: [] } };
  }

  if (path === "product.getImage" && fixtures.image) {
    return {
      data: STORY_IMAGE,
      pending: fixtures.image === "pending",
      error: fixtures.image === "error" ? "画像を取得できませんでした" : undefined,
    };
  }

  if (
    ["product.addImage", "product.replaceImage", "product.deleteImage"].includes(path) &&
    fixtures.imageMutation
  ) {
    return { data: { ok: true }, ...fixtures.imageMutation };
  }
}

function missingService(path: string, input: unknown, service: Service) {
  if (!serviceProcedures.has(path)) {
    return false;
  }

  if (!input || typeof input !== "object" || !("service" in input)) {
    return true;
  }

  return input.service !== service;
}

function storyError(result: StoryResult) {
  return TRPCClientError.from({
    error: {
      message: result.error!,
      code: result.errorCode === "FORBIDDEN" ? -32003 : -32603,
      data: {
        code: result.errorCode ?? "INTERNAL_SERVER_ERROR",
        errorCode: result.errorReason ?? result.errorCode ?? "INTERNAL_SERVER_ERROR",
        httpStatus: result.errorCode === "FORBIDDEN" ? 403 : 500,
      },
    },
  });
}

function storyLink(fixtures: StoryFixtures, service: Service): TRPCLink<AppRouter> {
  return () => (props) =>
    observable((observer) => {
      const result = storyResult(fixtures, props.op.path, props.op.type);
      // Storyでも操作するサービスを明示させ、画面の切替だけで別サービスを扱う誤りを見つける。
      if (missingService(props.op.path, props.op.input, service)) {
        observer.error(
          new TRPCClientError(
            `Storybook fixture is missing: explicit ${service} service for ${props.op.path}`,
          ),
        );
      } else if (!result) {
        observer.error(new TRPCClientError(`Storybook fixture is missing: ${props.op.path}`));
      } else if (result.error) {
        observer.error(storyError(result));
      } else if (!result.pending) {
        observer.next({ result: { data: result.data } });
        observer.complete();
      }

      return () => {};
    });
}
