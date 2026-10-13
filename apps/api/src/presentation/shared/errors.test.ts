import { describe, expect, it } from "vite-plus/test";
import { TRPCError } from "@trpc/server";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import { publicErrorCode, toRpcError } from "#api/presentation/shared/errors.ts";

describe("多言語表示用の公開エラーコード", () => {
  it("既知の理由を公開しても標準のHTTP・tRPC分類は維持する", () => {
    const error = toRpcError(
      new ApplicationError({
        code: "CONFLICT",
        reason: "LAST_OWNER_REQUIRED",
        message: "互換用の日本語説明",
      }),
    );
    expect(error.code).toBe("CONFLICT");
    expect(publicErrorCode(error)).toBe("LAST_OWNER_REQUIRED");
  });
  it("5xxでは理由を付けても内部障害のコードだけを公開する", () => {
    const error = toRpcError(
      new ApplicationError({
        code: "INTERNAL_SERVER_ERROR",
        reason: "EMAIL_VERIFICATION_REQUIRED",
        message: "private_database_detail",
      }),
    );
    expect(publicErrorCode(error)).toBe("INTERNAL_SERVER_ERROR");
    expect(publicErrorCode(new TRPCError({ code: "FORBIDDEN" }))).toBe("FORBIDDEN");
  });
});
