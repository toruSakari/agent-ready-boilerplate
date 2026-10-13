import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  isImageContentType,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MEBIBYTES,
} from "#api/application/product/policies/image-policy.ts";

const imageFields = z.object({ id: z.string().min(1), file: z.instanceof(File) });

// .inputは会員・権限ガードの後に置く。FormDataはtRPCが遅延解析し、総量は通信境界で制限する。
export const imageUploadInput = z.instanceof(FormData).transform((form) => {
  if (form.getAll("id").length !== 1 || form.getAll("file").length !== 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "商品と画像を1件ずつ指定してください" });
  }

  return imageFields.parse({ id: form.get("id"), file: form.get("file") });
});

// サイズ超過は入力パーサーの400に包まず、手続きの413として返す。
export async function readImageFile(file: File) {
  if (!isImageContentType(file.type)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "PNG・JPEG・WebP画像を選んでください" });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: `画像は${MAX_IMAGE_MEBIBYTES}MB以下にしてください`,
    });
  }

  if (!file.size) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "画像を選んでください" });
  }

  return { contentType: file.type, bytes: await file.arrayBuffer() };
}
