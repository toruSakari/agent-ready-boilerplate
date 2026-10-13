import { useState } from "react";
import type { ReactNode } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterContextProvider,
} from "@tanstack/react-router";

/** 通信fixtureの外側に実Routerを置き、リンクのparams・URL生成も単体テストで検証する。 */
export function TestRouter(props: { children: ReactNode }) {
  const [router] = useState(() => {
    const root = createRootRoute();
    const paths = [
      "/",
      "/account",
      "/organizations/$organizationId",
      "/organizations/$organizationId/products",
      "/organizations/$organizationId/members",
    ];
    const routes = paths.map((path) => createRoute({ getParentRoute: () => root, path }));
    return createRouter({
      routeTree: root.addChildren(routes),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
  });
  return <RouterContextProvider router={router}>{props.children}</RouterContextProvider>;
}
