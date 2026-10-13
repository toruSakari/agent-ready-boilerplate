import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@dev-template/api-types";
import { TRPCProvider } from "@dev-template/client/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { ProductImage } from "#business/entities/product/ui/product-image.tsx";

const product = { id: "product-1", name: "テスト商品", imageKey: "image-1" };
let queryClient: QueryClient;
let trpcClient: ReturnType<typeof createTRPCClient<AppRouter>>;

function imageResponse(contents = "image") {
  return Response.json({
    result: { data: { base64: btoa(contents), contentType: "image/png", etag: "image-etag" } },
  });
}

let createUrl = vi.fn<(object: Blob | MediaSource) => string>();
let revokeUrl = vi.fn<(url: string) => void>();
let fetchImage = vi.fn<typeof fetch>();

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  trpcClient = createTRPCClient<AppRouter>({ links: [httpLink({ url: "/api/trpc" })] });
  createUrl = vi
    .fn<(object: Blob | MediaSource) => string>()
    .mockReturnValueOnce("blob:first")
    .mockReturnValueOnce("blob:second");
  revokeUrl = vi.fn<(url: string) => void>();
  const OriginalURL = URL;
  vi.stubGlobal(
    "URL",
    class extends OriginalURL {
      static createObjectURL(object: Blob | MediaSource): string {
        return String(createUrl(object));
      }

      static revokeObjectURL(url: string): void {
        revokeUrl(url);
      }
    },
  );
  fetchImage = vi.fn<typeof fetch>().mockResolvedValue(imageResponse());
  vi.stubGlobal("fetch", fetchImage);
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

function preview(imageKey: string | null) {
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <ProductImage product={{ ...product, imageKey }} />
      </TRPCProvider>
    </QueryClientProvider>
  );
}

it("ProductImageの画像表示" + " / " + "画像が未登録なら取得せず、その状態を表示する", () => {
  render(preview(null));
  expect(screen.getByText("画像未登録")).toBeVisible();
  expect(fetchImage).not.toHaveBeenCalled();
});

it(
  "ProductImageの画像表示" + " / " + "画像の差し替えで再取得し、以前のBlob URLを解放する",
  async () => {
    const view = render(preview("image-1"));
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "blob:first"));
    fetchImage.mockResolvedValue(imageResponse("replacement"));
    view.rerender(preview("image-2"));
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "blob:second"));
    expect(fetchImage).toHaveBeenCalledTimes(2);
    const blob = createUrl.mock.calls[1]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect((blob as Blob).type).toBe("image/png");
    expect((blob as Blob).size).toBe("replacement".length);
    expect(revokeUrl).toHaveBeenCalledWith("blob:first");
    view.unmount();
    expect(revokeUrl).toHaveBeenCalledWith("blob:second");
  },
);

it(
  "ProductImageの画像表示" + " / " + "選択画像の取得を切り替えると以前の通信結果を表示しない",
  async () => {
    // 中断済みfetchが遅れて解決する場合も、旧画像が現在の選択を上書きしないことを確認する。
    let finishPrevious!: (response: Response) => void;
    fetchImage.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishPrevious = resolve;
        }),
    );
    const selected = (id: string) => (
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          <ProductImage
            product={product}
            image={{ id, key: `${id}-key`, createdAt: "2026-01-01T00:00:00.000Z" }}
          />
        </TRPCProvider>
      </QueryClientProvider>
    );
    const view = render(selected("first"));
    await waitFor(() => expect(fetchImage).toHaveBeenCalledTimes(1));
    const previousSignal = fetchImage.mock.calls[0]?.[1]?.signal;
    view.rerender(selected("second"));
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "blob:first"));
    expect(previousSignal?.aborted).toBe(true);
    const request = fetchImage.mock.calls[1]![0];
    const currentRequest = new URL(
      request instanceof Request ? request.url : String(request),
      window.location.origin,
    );
    expect(currentRequest.pathname).toBe("/api/trpc/product.getImage");
    expect(JSON.parse(currentRequest.searchParams.get("input") ?? "null")).toEqual({
      service: "business",
      id: "product-1",
      imageId: "second",
    });
    await act(async () => {
      finishPrevious(imageResponse("previous-image"));
    });
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:first");
    expect(createUrl).toHaveBeenCalledTimes(1);
  },
);

it(
  "ProductImageの画像表示" +
    " / " +
    "base64のバイナリを変えずにBlobへ戻し、画像削除時にもURLを解放する",
  async () => {
    const binary = String.fromCharCode(0, 127, 128, 255);
    fetchImage.mockResolvedValue(imageResponse(binary));
    const view = render(preview("image-1"));
    await screen.findByRole("img");
    const blob = createUrl.mock.calls[0]?.[0] as Blob;
    const contents = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("画像のData URLを取得できませんでした"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    expect(contents).toBe(`data:image/png;base64,${btoa(binary)}`);
    view.rerender(preview(null));
    expect(screen.getByText("画像未登録")).toBeVisible();
    expect(revokeUrl).toHaveBeenCalledWith("blob:first");
    expect(fetchImage).toHaveBeenCalledTimes(1);
  },
);

it("ProductImageの画像表示" + " / " + "取得失敗時は日本語を表示する", async () => {
  fetchImage.mockResolvedValue(new Response("Not found", { status: 404 }));
  render(preview("image-1"));
  expect(await screen.findByText("画像を取得できませんでした")).toBeVisible();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
