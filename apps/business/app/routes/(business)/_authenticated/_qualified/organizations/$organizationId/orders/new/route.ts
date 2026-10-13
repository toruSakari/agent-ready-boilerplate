import { organizationPathParams } from "@dev-template/client/route-params";
import { createFileRoute, notFound } from "@tanstack/react-router";

// 廃止した作成URLを動的な注文IDとして扱わず、保存済みのリンクも404で拒否する。
export const Route = createFileRoute(
  "/(business)/_authenticated/_qualified/organizations/$organizationId/orders/new/",
)({
  params: organizationPathParams,
  beforeLoad: () => {
    throw notFound();
  },
});
