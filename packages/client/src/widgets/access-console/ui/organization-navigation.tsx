"use client";
import { useService } from "#client/shared/api/client-context";
import { AuthorizedOrganizationNavigation } from "#client/widgets/access-console/ui/authorized-organization-navigation";

export function OrganizationNavigation(props: { organizationId: string }) {
  const service = useService();
  // 公開の招待画面には企業スコープがなく、このセッション読取はマウントされない。
  // 運営サービスでも企業権限へのフォールバックをせず、共有の注文導線を出さない。
  return service === "operator" ? null : (
    <AuthorizedOrganizationNavigation organizationId={props.organizationId} />
  );
}
