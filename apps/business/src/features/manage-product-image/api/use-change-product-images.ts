"use client";
import { t as translate, errorMessage, UserFacingError } from "@dev-template/client/i18n";

import { useMutation } from "@tanstack/react-query";
import { useTRPCClient } from "@dev-template/client/api";

import type { ImageChange } from "#business/features/manage-product-image/model/image-change.ts";

function imageChangeError(reason: unknown) {
  const data = reason instanceof Error && "data" in reason ? reason.data : undefined;
  // 認可コードはキャッシュの再検証へ残し、内部例外本文は公開しない。
  return Object.assign(new UserFacingError(errorMessage(reason)), { data });
}

/** API更新の成否にかかわらずonChangedで一覧を再取得し、その完了まで更新中として扱う。 */
export function useChangeProductImages(productId: string, onChanged: () => Promise<void>) {
  const trpc = useTRPCClient();
  return useMutation({
    // 応答が失われても保存済みの可能性があるため、自動再送による画像の二重追加を避ける。
    retry: false,
    mutationFn: async (change: ImageChange) => {
      let confirmedUploads = 0;
      try {
        if (change.kind === "remove") {
          await trpc.product.deleteImage.mutate({ id: productId, imageId: change.imageId });
          return;
        }

        const files = change.kind === "append" ? change.files : [change.file];
        // 1枚ずつ確定を数える。途中失敗は全体のロールバックではなく、確認済み枚数を利用者へ伝える。
        for (const file of files) {
          const form = new FormData();
          form.set("id", productId);
          form.set("file", file);
          if (change.kind === "append") {
            await trpc.product.addImage.mutate(form);
          } else {
            await trpc.product.replaceImage.mutate(form);
          }

          confirmedUploads++;
        }
      } catch (reason) {
        const error = imageChangeError(reason);
        if (change.kind === "append") {
          error.message += translate(
            "（{{total}}枚中{{confirmed}}枚の追加を確認しました。画像一覧を確認し、必要な画像だけ選び直してください）",
            {
              total: change.files.length,
              confirmed: confirmedUploads,
            },
          );
        }

        throw error;
      }
    },
    // 中断時も一覧を更新する。先行画像や、応答を受け取れなかった画像が保存済みの場合がある。
    onSettled: onChanged,
  });
}
