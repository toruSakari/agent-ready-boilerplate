"use client";
import { t as translate } from "#client/shared/i18n";
import { Link } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import { usePermissions } from "#client/entities/access";
import { Button } from "@dev-template/ui/button";

export function AuthorizedOrganizationNavigation(props: { organizationId: string }) {
  const { can } = usePermissions();
  return props.organizationId && can("order:read") ? (
    <Button asChild variant="outline">
      <Link<AnyRouter, string, "/organizations/$organizationId">
        to="/organizations/$organizationId"
        params={{ organizationId: props.organizationId }}
      >
        {translate("注文")}
      </Link>
    </Button>
  ) : null;
}
