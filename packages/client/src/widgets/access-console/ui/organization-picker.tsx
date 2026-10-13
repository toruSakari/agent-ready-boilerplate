"use client";
import { t as translate } from "#client/shared/i18n";
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import { useAccessSession } from "#client/entities/access";
import { useService } from "#client/shared/api/client-context";
import { Button } from "@dev-template/ui/button";
import { Card } from "@dev-template/ui/card";
import { ConsoleLayout } from "#client/widgets/access-console/ui/console-layout";

export function OrganizationPicker() {
  const session = useAccessSession();
  const service = useService();
  // 一社だけなら選択操作を省く。選択先はURLに載せ、別タブの企業選択と干渉させない。
  useEffect(() => {
    if (service !== "customer" && session.data.organizations.length === 1) {
      const org = session.data.organizations[0];
      if (org) {
        window.location.replace(`/organizations/${encodeURIComponent(org.id)}`);
      }
    }
  }, [session.data, service]);
  return (
    <ConsoleLayout
      title={service === "business" ? translate("利用する企業を選択") : translate("商品一覧")}
    >
      {service === "customer" && <p>{translate("企業への所属や招待なしで商品を購入できます。")}</p>}
      {service !== "customer" && session.data.organizations.length === 0 && (
        <p>{translate("所属企業がありません。企業の担当者から招待を受けてください。")}</p>
      )}
      {service !== "customer" &&
        session.data.organizations.map((o) => (
          <Card key={o.id} className="p-5">
            <h2 className="text-xl font-semibold">{o.name}</h2>
            <p>{o.roleName}</p>
            <Button asChild>
              <Link<AnyRouter, string, "/organizations/$organizationId">
                to="/organizations/$organizationId"
                params={{ organizationId: o.id }}
              >
                {translate("この企業に入る")}
              </Link>
            </Button>
          </Card>
        ))}
    </ConsoleLayout>
  );
}
