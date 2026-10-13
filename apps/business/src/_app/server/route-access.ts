import { organizationIdPathSchema } from "@dev-template/client/route-params";
import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, getCookie } from "@tanstack/react-start/server";
import { proxyApiRequest } from "@dev-template/config/proxy";
import { loadRouteAccess } from "@dev-template/client/route-access-loader";
import type { RouteAccessInput, RouteAccessState } from "@dev-template/client/route-access-loader";
import { z } from "zod";

// 固定したサービスの既存APIへ接続する。ルートの入力は資格や認可の証明として扱わない。
export const getRouteAccess: (options: { data: RouteAccessInput }) => Promise<RouteAccessState> =
  createServerFn({ method: "GET" })
    .validator(
      z.object({ qualified: z.boolean(), organizationId: organizationIdPathSchema.optional() }),
    )
    .handler(async (props) =>
      loadRouteAccess({
        request: getRequest(),
        service: "business",
        input: props.data,
        sessionToken: getCookie("__session"),
        fetch: (url, options) => proxyApiRequest(new Request(url, options), env.API),
      }),
    );
