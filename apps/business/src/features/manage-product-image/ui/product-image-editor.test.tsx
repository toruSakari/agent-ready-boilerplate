import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@dev-template/api-types";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { ServiceContext, TRPCProvider } from "@dev-template/client/api";
import { PRODUCT_IMAGE_LIMITS } from "#business/entities/product/index.ts";
import type { ProductImageEntry } from "#business/entities/product/index.ts";
import { ProductImageEditor } from "#business/features/manage-product-image/ui/product-image-editor.tsx";

const name = "テスト商品";
const firstImage = { id: "image-1", key: "first-key", createdAt: "2026-01-01T00:00:00.000Z" };
const secondImage = { id: "image-2", key: "second-key", createdAt: "2026-01-02T00:00:00.000Z" };
const imageFile = (filename = "product.png") =>
  new File(["image"], filename, { type: "image/png" });
let queryClient: QueryClient;
let trpcClient: ReturnType<typeof createTRPCClient<AppRouter>>;
let fetchImage = vi.fn<typeof fetch>();
let onChanged = vi.fn<() => Promise<void>>();
let onMutationError = vi.fn<(error: Error) => void>();

function imageResponse() {
  return Response.json({
    result: { data: { base64: btoa("image"), contentType: "image/png", etag: "image-etag" } },
  });
}

function success() {
  return Response.json({ result: { data: { ok: true } } });
}

function requestUrl(input: RequestInfo | URL) {
  return new URL(input instanceof Request ? input.url : String(input), window.location.origin);
}

beforeEach(() => {
  onMutationError = vi.fn<(error: Error) => void>();
  queryClient = new QueryClient({
    mutationCache: new MutationCache({ onError: onMutationError }),
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  trpcClient = createTRPCClient<AppRouter>({ links: [httpLink({ url: "/api/trpc" })] });
  fetchImage = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_url, init) =>
      init?.method === "POST" ? success() : imageResponse(),
    );
  onChanged = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  vi.stubGlobal("fetch", fetchImage);
  const OriginalURL = URL;
  vi.stubGlobal(
    "URL",
    class extends OriginalURL {
      static createObjectURL() {
        return "blob:image";
      }

      static revokeObjectURL() {}
    },
  );
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

function editor(images: readonly ProductImageEntry[] = []) {
  return render(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        <ServiceContext.Provider value="business">
          <ProductImageEditor
            productId="product-1"
            name={name}
            imageKey={images[0]?.key ?? null}
            images={images}
            onChanged={onChanged}
          />
        </ServiceContext.Provider>
      </TRPCProvider>
    </QueryClientProvider>,
  );
}

function selectFiles(files: File[], additional = true) {
  fireEvent.change(
    screen.getByLabelText(additional ? `${name}の画像を追加` : `${name}の画像`, { exact: true }),
    {
      target: { files },
    },
  );
}

function writes() {
  return fetchImage.mock.calls.filter((props) => {
    const [, init] = props;
    return init?.method === "POST";
  });
}

function jsonWrite(index: number) {
  const body = writes()[index]?.[1]?.body;
  if (typeof body !== "string") {
    throw new Error("JSONの書き込みを確認できませんでした");
  }

  return JSON.parse(body);
}

it(
  "ProductImageEditorの商品画像編集" + " / " + "メイン画像と追加画像を型付きtRPCから取得する",
  async () => {
    editor([firstImage, secondImage]);
    expect(await screen.findByRole("img", { name: `${name}の商品画像` })).toBeVisible();
    expect(await screen.findByRole("img", { name: `${name}の商品画像 2` })).toBeVisible();
    expect(
      fetchImage.mock.calls.map((props) => {
        const request = requestUrl(props[0]);
        expect(request.pathname).toBe("/api/trpc/product.getImage");
        return JSON.parse(request.searchParams.get("input") ?? "null");
      }),
    ).toEqual([
      { service: "business", id: "product-1" },
      { service: "business", id: "product-1", imageId: "image-2" },
    ]);
  },
);

it(
  "ProductImageEditorの商品画像編集" +
    " / " +
    "同じキャッシュで再表示しても保存済み画像が見え、エラーと選択を持ち越さない",
  async () => {
    let objectUrlSequence = 0;
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation(() => `blob:image-${++objectUrlSequence}`);
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
    fetchImage.mockImplementation(async (_url, init) => {
      if (init?.method === "POST") {
        throw new TypeError("Failed to fetch");
      }

      return imageResponse();
    });
    const firstView = editor([firstImage, secondImage]);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    selectFiles([imageFile("interrupted.png")]);
    expect(await screen.findByRole("alert")).toHaveTextContent("1枚中0枚の追加を確認しました");
    expect(onChanged).toHaveBeenCalledTimes(1);
    firstView.unmount();
    expect(revokeObjectURL.mock.calls).toEqual([["blob:image-1"], ["blob:image-2"]]);

    editor([firstImage, secondImage]);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(`${name}の画像を追加`)).toHaveValue("");
    expect(screen.getByLabelText(`${name}の画像を追加`)).toBeEnabled();
    // ページを離れてもBlobキャッシュは残るが、Object URLは再マウントのたびに作り直す。
    expect(createObjectURL).toHaveBeenCalledTimes(4);
    expect(screen.getAllByRole("img").map((image) => image.getAttribute("src"))).toEqual([
      "blob:image-3",
      "blob:image-4",
    ]);
    expect(
      fetchImage.mock.calls.filter((props) => {
        const [, init] = props;
        return init?.method !== "POST";
      }),
    ).toHaveLength(2);
    expect(writes()).toHaveLength(1);
  },
);

it(
  "ProductImageEditorの商品画像編集" + " / " + "選択画像が件数上限を超える場合は一枚も送信しない",
  async () => {
    editor();
    selectFiles(Array.from({ length: 21 }, (_, index) => imageFile(`${index}.png`)));
    expect(await screen.findByRole("alert")).toHaveTextContent("商品画像は20枚までです");
    expect(writes()).toHaveLength(0);
    expect(onChanged).not.toHaveBeenCalled();
  },
);

it(
  "ProductImageEditorの商品画像編集" +
    " / " +
    "複数画像を順に追加し、同じファイルを再選択でき、選択キャンセルでは通信しない",
  async () => {
    editor();
    const files = [imageFile("one.png"), imageFile("two.png")];
    selectFiles(files);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(
      writes().map((props) => {
        expect(props[1]?.body).toBeInstanceOf(FormData);
        const form = props[1]?.body as FormData;
        return [requestUrl(props[0]).pathname, form.get("id"), form.get("file")];
      }),
    ).toEqual([
      ["/api/trpc/product.addImage", "product-1", files[0]],
      ["/api/trpc/product.addImage", "product-1", files[1]],
    ]);
    selectFiles([]);
    expect(writes()).toHaveLength(2);
    selectFiles([files[0]!]);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2));
    expect(writes()).toHaveLength(3);
  },
);

it(
  "ProductImageEditorの商品画像編集" + " / " + "不正形式や容量超過が混ざる場合は追加を開始しない",
  async () => {
    editor();
    selectFiles([imageFile(), new File(["gif"], "invalid.gif", { type: "image/gif" })]);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "5MB以下のPNG・JPEG・WebP画像を選んでください",
    );
    const oversized = imageFile();
    Object.defineProperty(oversized, "size", { value: PRODUCT_IMAGE_LIMITS.maxSizeBytes + 1 });
    selectFiles([oversized]);
    expect(screen.getByLabelText(`${name}の画像を追加`)).toHaveAttribute("aria-invalid", "true");
    expect(writes()).toHaveLength(0);
    expect(onChanged).not.toHaveBeenCalled();
  },
);

it(
  "ProductImageEditorの商品画像編集" +
    " / " +
    "メイン画像の差し替えAPIを維持し、削除では表示中の画像IDを指定する",
  async () => {
    editor([firstImage]);
    selectFiles([imageFile()], false);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "画像を削除" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2));
    expect(writes().map((props) => requestUrl(props[0]).pathname)).toEqual([
      "/api/trpc/product.replaceImage",
      "/api/trpc/product.deleteImage",
    ]);
    const uploadedForm = writes()[0]![1]!.body;
    expect(uploadedForm).toBeInstanceOf(FormData);
    expect((uploadedForm as FormData).get("id")).toBe("product-1");
    expect(jsonWrite(1)).toEqual({ id: "product-1", imageId: "image-1" });
  },
);

it("ProductImageEditorの商品画像編集" + " / " + "指定した追加画像だけを削除する", async () => {
  editor([firstImage, secondImage]);
  fireEvent.click(screen.getByRole("button", { name: `${name}の画像2を削除` }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  expect(writes().map((props) => requestUrl(props[0]).pathname)).toEqual([
    "/api/trpc/product.deleteImage",
  ]);
  expect(jsonWrite(0)).toEqual({ id: "product-1", imageId: "image-2" });
});

it(
  "ProductImageEditorの商品画像編集" +
    " / " +
    "送信と一覧更新が終わるまで全操作を無効にして重複送信を防ぐ",
  async () => {
    let finishWrite!: (response: Response) => void;
    // 保存完了と一覧再取得の完了を別々に遅らせ、どちらを待つ間も操作を再開しないことを確認する。
    let finishRefresh!: () => void;
    fetchImage.mockImplementation(async (_url, init) =>
      init?.method === "POST"
        ? new Promise<Response>((resolve) => {
            finishWrite = resolve;
          })
        : imageResponse(),
    );
    onChanged.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    editor([firstImage, secondImage]);
    selectFiles([imageFile()]);
    selectFiles([imageFile()]);
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(await screen.findByRole("status")).toHaveTextContent("画像を更新中…");
    expect(screen.getByLabelText(`${name}の画像`, { exact: true })).toBeDisabled();
    expect(screen.getByLabelText(`${name}の画像を追加`)).toBeDisabled();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }

    await act(async () => {
      finishWrite(success());
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText(`${name}の画像を追加`)).toBeDisabled();
    await act(async () => {
      finishRefresh();
    });
    await waitFor(() => expect(screen.getByLabelText(`${name}の画像を追加`)).toBeEnabled());
    expect(writes()).toHaveLength(1);
  },
);

it(
  "ProductImageEditorの商品画像編集" +
    " / " +
    "途中で失敗した追加の成功枚数を示し、一覧を更新して残りの自動再送をしない",
  async () => {
    let uploads = 0;
    fetchImage.mockImplementation(async (_url, init) => {
      if (init?.method === "POST" && ++uploads === 2) {
        return Response.json(
          {
            error: {
              message: "画像を保存できませんでした",
              code: -32603,
              data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
            },
          },
          { status: 500 },
        );
      }

      return success();
    });
    editor();
    selectFiles([imageFile("one.png"), imageFile("two.png"), imageFile("three.png")]);
    expect(await screen.findByRole("alert")).toHaveTextContent("3枚中1枚の追加を確認しました");
    expect(screen.getByRole("alert")).toHaveTextContent("必要な画像だけ選び直してください");
    expect(writes()).toHaveLength(2);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(`${name}の画像を追加`)).toBeEnabled();
  },
);

it(
  "ProductImageEditorの商品画像編集" +
    " / " +
    "画像更新の認可拒否を日本語で表示し、共通キャッシュへtRPCの資格情報を残す",
  async () => {
    fetchImage.mockResolvedValue(
      Response.json(
        {
          error: {
            message: "この操作を行う権限がありません",
            code: -32003,
            data: { code: "FORBIDDEN", httpStatus: 403 },
          },
        },
        { status: 403 },
      ),
    );
    editor();
    selectFiles([imageFile()]);
    expect(await screen.findByRole("alert")).toHaveTextContent("この操作を行う権限がありません");
    expect(onMutationError).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { code: "FORBIDDEN", httpStatus: 403 },
      }),
      expect.anything(),
      undefined,
      expect.anything(),
      expect.anything(),
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(writes()).toHaveLength(1);
  },
);

it(
  "ProductImageEditorの商品画像編集" +
    " / " +
    "通信中断や非JSON応答でも日本語を表示して更新結果を確認する",
  async () => {
    fetchImage.mockRejectedValue(new TypeError("Failed to fetch"));
    editor();
    selectFiles([imageFile()]);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "処理に失敗しました。しばらくしてから再試行してください",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("Failed to fetch");
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(writes()).toHaveLength(1);
    fetchImage.mockImplementation(
      async () => new Response("private upstream detail", { status: 500 }),
    );
    selectFiles([imageFile()], false);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "処理に失敗しました。しばらくしてから再試行してください",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("private upstream detail");
  },
);
