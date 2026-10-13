// @vitest-environment node
import { expect, it, vi } from "vite-plus/test";
import {
  cloudflareApi,
  previewResourceNames,
  provisionPreviewResources,
  deletePreviewResources,
} from "@/tooling/preview-resources.mjs";

it("PRごとのPreviewリソース / 別PR・本番と同じ名前を生成しない", () => {
  expect(previewResourceNames("31")).toEqual({
    database: "dev-template-pr-31-db",
    bucket: "dev-template-pr-31-images",
    queue: "dev-template-pr-31-events",
  });
  expect(previewResourceNames("31")).not.toEqual(previewResourceNames("32"));
  expect(() => previewResourceNames("../production")).toThrow();
});

it("PRごとのPreviewリソース / 既存リソースを再利用し、別PRのDBを流用しない", async () => {
  const api = vi.fn(async (path: string) => {
    if (path.startsWith("/d1/")) {
      return {
        result: [
          { name: "dev-template-pr-32-db", uuid: "other" },
          { name: "dev-template-pr-31-db", uuid: "own" },
        ],
      };
    }

    if (path.startsWith("/queues")) {
      return { result: [{ queue_name: "dev-template-pr-31-events", queue_id: "queue" }] };
    }

    return { result: { name: "dev-template-pr-31-images" } };
  });
  expect(await provisionPreviewResources("31", api)).toMatchObject({ databaseId: "own" });
  expect(api.mock.calls.every((call) => call.length === 1)).toBe(true);
});

it("PRごとのPreviewリソース / 新規PRのDB・R2・Queueを専用名で作成する", async () => {
  const api = vi.fn(
    async (path: string, method?: string, body?: { name?: string; queue_name?: string }) => {
      if (method === "POST") {
        return { result: { name: body?.name, uuid: "new", queue_name: body?.queue_name } };
      }

      if (path.startsWith("/r2/")) {
        return null;
      }

      return { result: [] };
    },
  );
  await provisionPreviewResources("31", api);
  expect(api).toHaveBeenCalledWith("/d1/database", "POST", { name: "dev-template-pr-31-db" });
  expect(api).toHaveBeenCalledWith("/r2/buckets", "POST", { name: "dev-template-pr-31-images" });
  expect(api).toHaveBeenCalledWith("/queues", "POST", {
    queue_name: "dev-template-pr-31-events",
  });
});

it("PRごとのPreviewリソース / 削除は対象PRの画像・DB・Queueに限定し、未移行DBにも対応する", async () => {
  const api = vi.fn(async (path: string, method?: string) => {
    if (method === "DELETE") {
      return { result: {} };
    }

    if (path.endsWith("/query")) {
      return { result: [{ results: [] }] };
    }

    if (path.startsWith("/d1/")) {
      return {
        result: [
          { name: "dev-template-pr-31-db", uuid: "own" },
          { name: "dev-template-pr-32-db", uuid: "other" },
        ],
      };
    }

    if (path.startsWith("/queues")) {
      return { result: [{ queue_name: "dev-template-pr-31-events", queue_id: "own-queue" }] };
    }

    return { result: {} };
  });
  await deletePreviewResources("31", api);
  expect(api).toHaveBeenCalledWith("/d1/database/own", "DELETE");
  expect(api).not.toHaveBeenCalledWith("/d1/database/other", "DELETE");
});

it("PRごとのPreviewリソース / 専用DBの追跡画像をR2データAPIで削除してからバケットを削除する", async () => {
  const deleteObject = vi.fn(async () => undefined);
  const api = vi.fn(async (path: string, method?: string, body?: { sql?: string }) => {
    if (method === "DELETE") {
      if (path.includes("/r2/")) {
        expect(deleteObject).toHaveBeenCalledWith(
          "dev-template-pr-31-images",
          "tenant/product/image",
        );
      }

      return { result: {} };
    }

    if (path.endsWith("/query")) {
      return {
        result: [
          {
            results: body?.sql?.includes("sqlite_master")
              ? [{ name: "product_images" }]
              : [{ image_key: "tenant/product/image" }],
          },
        ],
      };
    }

    if (path.startsWith("/d1/")) {
      return { result: [{ name: "dev-template-pr-31-db", uuid: "own" }] };
    }

    if (path.startsWith("/queues")) {
      return { result: [] };
    }

    return { result: {} };
  });
  await deletePreviewResources("31", api, deleteObject);
  expect(deleteObject).toHaveBeenCalledTimes(1);
});

it("PRごとのPreviewリソース / 既に削除済みのリソースは繰り返し削除しても成功する", async () => {
  const api = cloudflareApi(
    { CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_API_TOKEN: "secret" },
    async () => new Response(null, { status: 404 }),
  );
  await expect(api("/workers/scripts/dev-template-web-pr-31", "DELETE")).resolves.toBeNull();
});

it("PRごとのPreviewリソース / APIエラーの本文と資格情報を例外に公開しない", async () => {
  const api = cloudflareApi(
    { CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_API_TOKEN: "secret" },
    async () =>
      Response.json({ success: false, errors: [{ message: "private token" }] }, { status: 403 }),
  );
  await expect(api("/d1/database")).rejects.toThrow("HTTP 403");
  await expect(api("/d1/database")).rejects.not.toThrow("private token");
});
