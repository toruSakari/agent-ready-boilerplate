import { RouteError } from "@dev-template/client/route-error";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { routeTree } from "#app/routeTree.gen.ts";

// Workerが発行したnonceをStartのストリームとクライアント初期化にも渡す。
const readNonce = createIsomorphicFn()
  .server(() => getRequestHeader("x-csp-nonce"))
  .client(() => document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.nonce);

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: RouteError,
    scrollRestoration: true,
    ssr: { nonce: readNonce() },
  });
}
