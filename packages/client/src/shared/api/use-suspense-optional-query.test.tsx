import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it } from "vite-plus/test";
import { useSuspenseOptionalQuery } from "#client/shared/api/use-suspense-optional-query";
import { DataErrorBoundary } from "#client/shared/ui/error-boundary";

afterEach(cleanup);

it("初回取得は名前付きSkeletonで待ち、他の領域を残して取得後の内容へ切り替える", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  let resolve!: (value: string[]) => void;
  const response = new Promise<string[]>((done) => {
    resolve = done;
  });
  function Content() {
    const query = useSuspenseOptionalQuery({
      queryKey: ["suspense-test"],
      queryFn: () => response,
    });
    return query.data === null ? null : <p>{query.data.join(",")}</p>;
  }
  render(
    <QueryClientProvider client={client}>
      <p>入力を続けられる別領域</p>
      <DataErrorBoundary loadingLabel="一覧を読み込み中…">
        <Content />
      </DataErrorBoundary>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("status", { name: "一覧を読み込み中…" })).toBeVisible();
  expect(screen.getByText("入力を続けられる別領域")).toBeVisible();
  await act(async () => {
    resolve(["取得後のデータ"]);
  });
  expect(await screen.findByText("取得後のデータ")).toBeVisible();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  client.clear();
});
