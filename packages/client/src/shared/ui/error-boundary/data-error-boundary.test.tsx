import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { createScopedQueryClient } from "#client/_app/providers/session-cache";
import { DataErrorBoundary } from "#client/shared/ui/error-boundary/data-error-boundary";
import { CatchBoundary } from "@tanstack/react-router";
import { ErrorFallback } from "#client/shared/ui/error-boundary/error-fallback";
import { shouldThrowQueryError } from "#client/shared/api/query-access";

afterEach(cleanup);

it("局所的な取得失敗を隔離し、再試行で回復しても成功データや更新操作を再実行しない", async () => {
  const client = createScopedQueryClient();
  client.setDefaultOptions({ queries: { retry: false, throwOnError: shouldThrowQueryError } });
  const read = vi
    .fn()
    .mockRejectedValueOnce(new Error("secret database detail"))
    .mockResolvedValue("回復しました");
  const successfulRead = vi.fn().mockResolvedValue("成功済み");
  const update = vi.fn().mockResolvedValue("更新済み");
  await client.fetchQuery({
    queryKey: ["successful"],
    queryFn: successfulRead,
    staleTime: Infinity,
  });
  await client.getMutationCache().build(client, { mutationFn: update }).execute(undefined);
  function Section() {
    const result = useQuery({ queryKey: ["broken"], queryFn: read });
    return <p>{result.data ?? "読み込み中"}</p>;
  }
  const caught = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <p>別の領域</p>
      <DataErrorBoundary>
        <Section />
      </DataErrorBoundary>
    </QueryClientProvider>,
    { onCaughtError: caught },
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("通信状況を確認");
  expect(screen.getByText("別の領域")).toBeVisible();
  expect(screen.queryByText("secret database detail")).not.toBeInTheDocument();
  expect(caught).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "もう一度確認" }));
  expect(await screen.findByText("回復しました")).toBeVisible();
  expect(read).toHaveBeenCalledTimes(2);
  expect(successfulRead).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledTimes(1);
  client.clear();
});

it("Reactの描画例外もBoundaryで捕捉し、内部文言を公開しない", async () => {
  function Broken(): never {
    throw new Error("private render detail");
  }
  const caught = vi.fn();
  render(
    <CatchBoundary getResetKey={() => "test"} errorComponent={ErrorFallback}>
      <Broken />
    </CatchBoundary>,
    { onCaughtError: caught },
  );
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByText("private render detail")).not.toBeInTheDocument();
  expect(caught).toHaveBeenCalled();
});

it("非表示を指定した任意一覧の403だけを縮退し、401や通信失敗はthrowする", () => {
  const optional = { meta: { forbiddenBehavior: "hide-section" as const } };
  expect(shouldThrowQueryError({ data: { code: "FORBIDDEN" } }, optional)).toBe(false);
  expect(shouldThrowQueryError({ data: { code: "UNAUTHORIZED" } }, optional)).toBe(true);
  expect(shouldThrowQueryError(new Error("network"), optional)).toBe(true);
  expect(shouldThrowQueryError({ data: { code: "FORBIDDEN" } }, {})).toBe(true);
});
