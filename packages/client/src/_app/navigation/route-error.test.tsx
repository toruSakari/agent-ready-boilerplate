import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { RouteError } from "#client/_app/navigation/route-error";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("公式のdefaultErrorComponentが入口の例外を捕捉し、invalidateとresetで再試行する", async () => {
  // jsdomにはスクロール実装がないため、公式RouterのブラウザーAPI呼び出しだけを補う。
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  let failing = true;
  const beforeLoad = vi.fn(() => {
    if (failing) {
      throw new Error("private detail");
    }
  });
  function Page() {
    return <p>回復後のページ</p>;
  }
  const root = createRootRoute();
  const route = createRoute({ getParentRoute: () => root, path: "/", component: Page, beforeLoad });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    defaultErrorComponent: RouteError,
    history: createMemoryHistory({ initialEntries: ["/"] }),
    isServer: false,
  });
  await router.load();
  render(<RouterProvider router={router} />, { onCaughtError: vi.fn() });
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByText("private detail")).not.toBeInTheDocument();
  const attempts = beforeLoad.mock.calls.length;
  failing = false;
  fireEvent.click(screen.getByRole("button", { name: "もう一度確認" }));
  expect(await screen.findByText("回復後のページ")).toBeVisible();
  expect(beforeLoad.mock.calls.length).toBeGreaterThan(attempts);
});
