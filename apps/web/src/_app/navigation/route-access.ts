import type { RouteAccessInput, RouteAccessState } from "@dev-template/client/route-access";

// Startの照会クライアントは保護ルートで必要になったときだけ読み込む。
export async function readRouteAccess(data: RouteAccessInput): Promise<RouteAccessState> {
  const { getRouteAccess } = await import("#web/_app/server/route-access.ts");
  return getRouteAccess({ data });
}
